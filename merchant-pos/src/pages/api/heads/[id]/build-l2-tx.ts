import type { NextApiRequest, NextApiResponse } from "next";
import { readFileSync } from "fs";
import { z } from "zod";
import * as csl from "@emurgo/cardano-serialization-lib-nodejs";
import axios from "axios";

import { getHeadById } from "~/server/heads";
import { getHeadKeyByRole } from "~/server/head_keys";

/**
 * POST /api/heads/[id]/build-l2-tx
 *
 * Body: { from_address, amount_lovelace }
 *
 * Builds an unsigned in-head Cardano tx:
 *   - Input: the largest in-head UTxO at `from_address`
 *   - Output: `amount_lovelace` to the merchant's in-head address
 *   - Change: back to `from_address`
 *
 * Returns the unsigned tx CBOR for the user's wallet to sign with Vespr's
 * CIP-30 signTx. Non-custodial: the server holds no key for the input UTxO.
 */
const Body = z.object({
  from_address: z.string().min(50).max(200),
  amount_lovelace: z.string().regex(/^\d+$/),
});

const PROTO_PARAMS_PATH =
  process.env.HYDRA_PROTOCOL_PARAMS ??
  "./infra/hydra/config/protocol-parameters.json";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method Not Allowed" });
  const id = typeof req.query.id === "string" ? req.query.id : null;
  if (!id) return res.status(400).json({ error: "missing head id" });

  const parsed = Body.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.message });
  const { from_address, amount_lovelace } = parsed.data;
  const amount = BigInt(amount_lovelace);
  if (amount < 1_000_000n) return res.status(400).json({ error: "minimum 1 ADA" });

  const head = await getHeadById(id);
  if (!head) return res.status(404).json({ error: "head not found" });

  const merchantKey = await getHeadKeyByRole(id, "merchant");
  if (!merchantKey) return res.status(500).json({ error: "merchant head key missing" });

  const networkId = csl.NetworkInfo.mainnet().network_id();
  const merchantVk = csl.PublicKey.from_hex(merchantKey.cardanoVk);
  const merchantAddr = csl
    .EnterpriseAddress.new(networkId, csl.Credential.from_keyhash(merchantVk.hash()))
    .to_address();

  // Fetch in-head UTxOs
  const port = head.merchantApiPort;
  let snapshot: Record<string, { address: string; value: { lovelace: number } }>;
  try {
    const r = await axios.get(`http://${process.env.HYDRA_NODE_HOST}:${port}/snapshot/utxo`, {
      timeout: 5000,
      validateStatus: () => true,
    });
    if (r.status !== 200) return res.status(502).json({ error: `snapshot/utxo HTTP ${r.status}` });
    snapshot = r.data ?? {};
  } catch (e) {
    return res
      .status(502)
      .json({ error: e instanceof Error ? e.message : "snapshot/utxo fetch failed" });
  }

  const candidates = Object.entries(snapshot)
    .filter(([, u]) => u.address === from_address)
    .sort((a, b) => Number(BigInt(b[1].value.lovelace) - BigInt(a[1].value.lovelace)));
  if (candidates.length === 0)
    return res.status(400).json({ error: `no in-head UTxO at ${from_address}` });

  const [utxoRef, utxoData] = candidates[0]!;
  const inputLovelace = BigInt(utxoData.value.lovelace);
  if (inputLovelace < amount + 1_200_000n) {
    return res.status(400).json({
      error: `insufficient input: ${inputLovelace} < ${amount} + 1.2 ADA min-utxo+fee headroom`,
    });
  }

  // Build the tx (mirrors demo-pay's CSL construction).
  const pp = JSON.parse(readFileSync(PROTO_PARAMS_PATH, "utf8")) as Record<string, unknown>;
  const config = csl.TransactionBuilderConfigBuilder.new()
    .fee_algo(
      csl.LinearFee.new(
        csl.BigNum.from_str(String((pp.txFeePerByte as number) ?? 44)),
        csl.BigNum.from_str(String((pp.txFeeFixed as number) ?? 155381)),
      ),
    )
    .pool_deposit(csl.BigNum.from_str(String((pp.stakePoolDeposit as number) ?? 500000000)))
    .key_deposit(csl.BigNum.from_str(String((pp.stakeAddressDeposit as number) ?? 2000000)))
    .max_tx_size((pp.maxTxSize as number) ?? 16384)
    .max_value_size((pp.maxValueSize as number) ?? 5000)
    .coins_per_utxo_byte(csl.BigNum.from_str(String((pp.utxoCostPerByte as number) ?? 4310)))
    .build();
  const builder = csl.TransactionBuilder.new(config);

  // Extract payment key-hash from the from_address so the builder knows the
  // input is key-witnessed. Vespr will produce the witness at signTx time.
  const [txHashHex, ixStr] = utxoRef.split("#");
  const fromAddrObj = csl.Address.from_bech32(from_address);
  let paymentKeyHash: csl.Ed25519KeyHash | null = null;
  const baseAddr = csl.BaseAddress.from_address(fromAddrObj);
  if (baseAddr) paymentKeyHash = baseAddr.payment_cred().to_keyhash() ?? null;
  if (!paymentKeyHash) {
    const entAddr = csl.EnterpriseAddress.from_address(fromAddrObj);
    if (entAddr) paymentKeyHash = entAddr.payment_cred().to_keyhash() ?? null;
  }
  if (!paymentKeyHash) {
    return res
      .status(400)
      .json({ error: "from_address has no payment key-hash (script address not supported)" });
  }
  const fromAddr = fromAddrObj;
  builder.add_key_input(
    paymentKeyHash,
    csl.TransactionInput.new(
      csl.TransactionHash.from_bytes(Buffer.from(txHashHex!, "hex")),
      Number(ixStr),
    ),
    csl.Value.new(csl.BigNum.from_str(inputLovelace.toString())),
  );
  builder.add_output(
    csl.TransactionOutput.new(merchantAddr, csl.Value.new(csl.BigNum.from_str(amount.toString()))),
  );
  builder.set_ttl_bignum(csl.BigNum.from_str("99999999999"));
  builder.add_change_if_needed(fromAddr);

  const body = builder.build();
  const unsigned = csl.Transaction.new(body, csl.TransactionWitnessSet.new());
  const cborHex = Buffer.from(unsigned.to_bytes()).toString("hex");

  return res.status(200).json({
    unsigned_cbor: cborHex,
    input_utxo: utxoRef,
    input_lovelace: inputLovelace.toString(),
    from_address,
    to_address: merchantAddr.to_bech32(),
    amount_lovelace,
  });
}
