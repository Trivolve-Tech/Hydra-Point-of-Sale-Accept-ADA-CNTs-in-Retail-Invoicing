import type { NextApiRequest, NextApiResponse } from "next";
import { readFileSync } from "fs";
import { z } from "zod";
import * as csl from "@emurgo/cardano-serialization-lib-nodejs";

import { getHeadById } from "~/server/heads";
import { getHeadKeyByRole } from "~/server/head_keys";
import { getHydraRegistry, makeHydraHttpClient } from "~/server/hydra/registry";

// In-head L2 payment: spend a UTxO at `from` party's enterprise address inside
// the open Hydra head, send `amount_lovelace` to the `to` party's enterprise
// address. Signs with the from-party's cardano-sk on disk.
const BodySchema = z.object({
  amount_lovelace: z.string().regex(/^\d+$/),
  // For v1 fully-custodial demo, default direction is customer → merchant.
  from: z.enum(["customer", "merchant"]).default("customer"),
  to: z.enum(["customer", "merchant"]).default("merchant"),
});

const PROTO_PARAMS_PATH =
  process.env.HYDRA_PROTOCOL_PARAMS ??
  process.env.HYDRA_PROTOCOL_PARAMS ?? "./infra/hydra/config/protocol-parameters.json";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method Not Allowed" });
  const id = typeof req.query.id === "string" ? req.query.id : null;
  if (!id) return res.status(400).json({ error: "missing id" });

  const parsed = BodySchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.message });
  const { amount_lovelace, from, to } = parsed.data;
  if (from === to) return res.status(400).json({ error: "from and to must differ" });
  const amount = BigInt(amount_lovelace);
  // Cardano min-UTxO floor for a pure-lovelace output is around 0.85 ADA.
  // Reject below 1 ADA so both the recipient output and the change satisfy it.
  if (amount < 1_000_000n) {
    return res.status(400).json({ error: "minimum payment is 1 ADA (Cardano min-UTxO)" });
  }

  const head = await getHeadById(id);
  if (!head) return res.status(404).json({ error: "head not found" });
  const fromKey = await getHeadKeyByRole(id, from);
  const toKey = await getHeadKeyByRole(id, to);
  if (!fromKey?.cardanoSkPath || !toKey)
    return res.status(500).json({ error: "head keys missing" });

  // Load from-party signing key (32-byte normal Ed25519 TextEnvelope).
  let sk: csl.PrivateKey;
  try {
    const env = JSON.parse(readFileSync(fromKey.cardanoSkPath, "utf8")) as { cborHex: string };
    const hex = env.cborHex;
    if (!hex.startsWith("5820") || hex.length !== 68) {
      return res.status(500).json({ error: `unsupported sk envelope cborHex length ${hex.length}` });
    }
    sk = csl.PrivateKey.from_normal_bytes(Buffer.from(hex.slice(4), "hex"));
  } catch (e) {
    return res.status(500).json({ error: `cannot read sk: ${e instanceof Error ? e.message : e}` });
  }

  const networkId = csl.NetworkInfo.mainnet().network_id();
  const fromVk = sk.to_public();
  const toVk = csl.PublicKey.from_hex(toKey.cardanoVk);
  const fromCred = csl.Credential.from_keyhash(fromVk.hash());
  const toCred = csl.Credential.from_keyhash(toVk.hash());
  const fromAddr = csl.EnterpriseAddress.new(networkId, fromCred).to_address();
  const toAddr = csl.EnterpriseAddress.new(networkId, toCred).to_address();
  const fromBech = fromAddr.to_bech32();

  // Fetch in-head UTxOs from any party's hydra-node; pick from-party's UTxO.
  const httpClient = await makeHydraHttpClient(id);
  if (!httpClient) return res.status(503).json({ error: "head not reachable" });
  let snapshot: Record<string, { address: string; value: { lovelace: number } }>;
  try {
    const r = await httpClient.getSnapshotUtxo();
    snapshot = (r.data ?? {}) as typeof snapshot;
  } catch (e) {
    return res.status(502).json({ error: `cannot read /snapshot/utxo: ${e instanceof Error ? e.message : e}` });
  }
  const candidates = Object.entries(snapshot).filter(([, u]) => u.address === fromBech);
  candidates.sort((a, b) => Number(BigInt(b[1].value.lovelace) - BigInt(a[1].value.lovelace)));
  if (candidates.length === 0) {
    return res.status(400).json({ error: `no in-head UTxO at ${fromBech}` });
  }
  const [utxoRef, utxoData] = candidates[0]!;
  const inputLovelace = BigInt(utxoData.value.lovelace);
  if (inputLovelace < amount + 1_200_000n) {
    return res
      .status(400)
      .json({ error: `insufficient input: ${inputLovelace} lovelace < ${amount} + 1.2 ADA min-utxo+fee headroom (need a bigger UTxO at from address)` });
  }

  // Build the in-head Cardano tx.
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

  const [txHashHex, ixStr] = utxoRef.split("#");
  builder.add_key_input(
    fromVk.hash(),
    csl.TransactionInput.new(
      csl.TransactionHash.from_bytes(Buffer.from(txHashHex!, "hex")),
      Number(ixStr),
    ),
    csl.Value.new(csl.BigNum.from_str(inputLovelace.toString())),
  );
  builder.add_output(
    csl.TransactionOutput.new(toAddr, csl.Value.new(csl.BigNum.from_str(amount.toString()))),
  );
  // In-head txs have no real TTL constraint; use a far-future slot.
  builder.set_ttl_bignum(csl.BigNum.from_str("99999999999"));
  builder.add_change_if_needed(fromAddr);

  const body = builder.build();

  // Compute the body hash via FixedTransaction (CSL 13.x).
  const unsigned = csl.Transaction.new(body, csl.TransactionWitnessSet.new());
  const fixed = csl.FixedTransaction.from_bytes(unsigned.to_bytes());
  const bodyHash = fixed.transaction_hash();

  // Sign + assemble witness set.
  const witnesses = csl.TransactionWitnessSet.new();
  const vkeys = csl.Vkeywitnesses.new();
  vkeys.add(csl.make_vkey_witness(bodyHash, sk));
  witnesses.set_vkeys(vkeys);
  const signed = csl.Transaction.new(body, witnesses);
  const cborHex = Buffer.from(signed.to_bytes()).toString("hex");

  // Submit via the merchant node's WebSocket (router default).
  const router = await getHydraRegistry().getRouter(id);
  if (!router) return res.status(503).json({ error: "router not available" });

  let result;
  try {
    result = await router.submitL2Transaction(cborHex, "demo-pay");
  } catch (e) {
    return res.status(500).json({
      success: false,
      error: e instanceof Error ? e.message : "submit failed",
      direction: `${from} → ${to}`,
      amount_lovelace,
      from_address: fromBech,
      to_address: toAddr.to_bech32(),
    });
  }
  return res.status(200).json({
    direction: `${from} → ${to}`,
    amount_lovelace,
    input_utxo: utxoRef,
    input_lovelace: inputLovelace.toString(),
    to_address: toAddr.to_bech32(),
    from_address: fromBech,
    ...result,
  });
}
