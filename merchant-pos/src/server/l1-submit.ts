import axios from "axios";

const BF_BASE = process.env.BLOCKFROST_URL ?? "https://cardano-mainnet.blockfrost.io/api/v0";

/** Submit a signed Cardano tx CBOR (hex) to Blockfrost. Returns the L1 tx id. */
export async function submitToL1(cborHex: string): Promise<string> {
  const key = process.env.BLOCKFROST_KEY;
  if (!key) throw new Error("BLOCKFROST_KEY env required for L1 submit");
  const bytes = Buffer.from(cborHex, "hex");
  const r = await axios.post(`${BF_BASE}/tx/submit`, bytes, {
    headers: { project_id: key, "Content-Type": "application/cbor" },
    validateStatus: () => true,
    timeout: 20000,
    maxBodyLength: Infinity,
  });
  if (r.status !== 200) {
    const body = typeof r.data === "string" ? r.data : JSON.stringify(r.data);
    throw new Error(`Blockfrost /tx/submit ${r.status}: ${body.slice(0, 600)}`);
  }
  return typeof r.data === "string" ? r.data : (r.data as { hash?: string }).hash ?? "submitted";
}

/** Fetch UTxOs at an L1 address via Blockfrost. */
export async function listL1Utxos(address: string): Promise<
  Array<{ ref: string; lovelace: bigint; raw: { tx_hash: string; output_index: number } }>
> {
  const key = process.env.BLOCKFROST_KEY;
  if (!key) throw new Error("BLOCKFROST_KEY env required for L1 utxo fetch");
  const r = await axios.get<
    Array<{
      tx_hash: string;
      output_index: number;
      amount: { unit: string; quantity: string }[];
    }>
  >(`${BF_BASE}/addresses/${address}/utxos`, {
    headers: { project_id: key },
    validateStatus: () => true,
    timeout: 10000,
  });
  if (r.status === 404) return [];
  if (r.status !== 200) throw new Error(`Blockfrost utxos ${r.status}`);
  return r.data.map((u) => ({
    ref: `${u.tx_hash}#${u.output_index}`,
    lovelace: BigInt(u.amount.find((a) => a.unit === "lovelace")?.quantity ?? "0"),
    raw: { tx_hash: u.tx_hash, output_index: u.output_index },
  }));
}
