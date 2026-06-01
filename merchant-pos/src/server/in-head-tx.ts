import { readFileSync } from "fs";
import * as csl from "@emurgo/cardano-serialization-lib-nodejs";
import axios from "axios";

const PROTO_PARAMS_PATH =
  process.env.HYDRA_PROTOCOL_PARAMS ??
  "./infra/hydra/config/protocol-parameters.json";

/** Sign a Cardano tx CBOR with a single ed25519 spend key. Uses
 *  FixedTransaction so the original body bytes are preserved (re-serializing
 *  TransactionBody can produce different bytes and break the body hash). */
export function signTxWithKey(cborHex: string, sk: csl.PrivateKey): string {
  const ft = csl.FixedTransaction.from_hex(cborHex);
  ft.sign_and_add_vkey_signature(sk);
  return ft.to_hex();
}

/**
 * Build + sign an in-head Cardano tx that sends `amountLovelace` from
 * `fromAddress` (a per-customer deposit address) to `toAddress` (merchant
 * in-head address). The full unspent input value is consumed; change goes
 * back to `fromAddress`.
 *
 * Returns the signed tx CBOR hex, ready to POST to hydra-node /transaction.
 */
export async function buildAndSignInHeadTx(params: {
  hydraHost: string;
  hydraPort: number;
  fromAddress: string;
  fromSk: csl.PrivateKey;
  toAddress: csl.Address;
  amountLovelace: bigint;
}): Promise<{ cborHex: string; inputUtxoRef: string; inputLovelace: bigint }> {
  const { hydraHost, hydraPort, fromAddress, fromSk, toAddress, amountLovelace } = params;

  const snapR = await axios.get<Record<string, { address: string; value: { lovelace: number } }>>(
    `http://${hydraHost}:${hydraPort}/snapshot/utxo`,
    { timeout: 5000, validateStatus: () => true },
  );
  if (snapR.status !== 200) {
    throw new Error(`hydra-node /snapshot/utxo ${snapR.status}`);
  }
  const snap = snapR.data ?? {};
  const candidates = Object.entries(snap)
    .filter(([, u]) => u.address === fromAddress)
    .sort((a, b) => Number(BigInt(b[1].value.lovelace) - BigInt(a[1].value.lovelace)));
  if (candidates.length === 0) {
    throw new Error(`no in-head UTxO at ${fromAddress} — fund the head first`);
  }
  const [utxoRef, utxoData] = candidates[0]!;
  const inputLovelace = BigInt(utxoData.value.lovelace);
  if (inputLovelace < amountLovelace + 1_200_000n) {
    throw new Error(
      `insufficient in-head input: have ${inputLovelace} need ${amountLovelace} + 1.2 ADA headroom`,
    );
  }

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
  const fromAddrObj = csl.Address.from_bech32(fromAddress);
  const baseAddr = csl.BaseAddress.from_address(fromAddrObj);
  const entAddr = csl.EnterpriseAddress.from_address(fromAddrObj);
  const paymentKeyHash =
    baseAddr?.payment_cred().to_keyhash() ?? entAddr?.payment_cred().to_keyhash() ?? null;
  if (!paymentKeyHash) {
    throw new Error("from_address has no payment key-hash (script address not supported)");
  }

  builder.add_key_input(
    paymentKeyHash,
    csl.TransactionInput.new(
      csl.TransactionHash.from_bytes(Buffer.from(txHashHex!, "hex")),
      Number(ixStr),
    ),
    csl.Value.new(csl.BigNum.from_str(inputLovelace.toString())),
  );
  builder.add_output(
    csl.TransactionOutput.new(toAddress, csl.Value.new(csl.BigNum.from_str(amountLovelace.toString()))),
  );
  builder.set_ttl_bignum(csl.BigNum.from_str("99999999999"));
  builder.add_change_if_needed(fromAddrObj);

  const body = builder.build();
  const unsigned = csl.Transaction.new(body, csl.TransactionWitnessSet.new());
  const unsignedCborHex = Buffer.from(unsigned.to_bytes()).toString("hex");
  const signed = signTxWithKey(unsignedCborHex, fromSk);
  return { cborHex: signed, inputUtxoRef: utxoRef, inputLovelace };
}
