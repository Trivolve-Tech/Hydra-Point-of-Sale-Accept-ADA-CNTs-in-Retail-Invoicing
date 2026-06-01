import type { NextApiRequest, NextApiResponse } from "next";
import axios from "axios";
import { desc } from "drizzle-orm";

import { getProfile } from "~/server/customer-profile";
import { getDb } from "~/server/db/client";
import { heads } from "~/server/db/schema";

const BF_BASE = process.env.BLOCKFROST_URL ?? "https://cardano-mainnet.blockfrost.io/api/v0";
const BF_KEY = process.env.BLOCKFROST_KEY;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method Not Allowed" });
  const id = typeof req.query.id === "string" ? req.query.id : null;
  if (!id) return res.status(400).json({ error: "missing id" });
  const profile = await getProfile(id);
  if (!profile) return res.status(404).json({ error: "profile not found" });

  // L1 — list UTxOs
  let l1_lovelace = 0;
  const l1_utxos: Array<{ ref: string; lovelace: number }> = [];
  if (BF_KEY && profile.address) {
    try {
      const r = await axios.get<Array<{ tx_hash: string; output_index: number; amount: { unit: string; quantity: string }[] }>>(
        `${BF_BASE}/addresses/${profile.address}/utxos`,
        { headers: { project_id: BF_KEY }, validateStatus: () => true },
      );
      if (r.status === 200 && Array.isArray(r.data)) {
        for (const u of r.data) {
          const l = u.amount.find((a) => a.unit === "lovelace")?.quantity;
          if (!l) continue;
          const n = Number(l);
          l1_lovelace += n;
          l1_utxos.push({ ref: `${u.tx_hash}#${u.output_index}`, lovelace: n });
        }
      }
    } catch {}
  }

  // L2 — sum UTxOs at the wallet addr inside the head's snapshot.
  // Use the active head's merchant API port (4100), not the static
  // HYDRA_NODE_PORT env var (which is the legacy 4001 default).
  let l2_lovelace = 0;
  let l2_utxo_count = 0;
  const host = process.env.HYDRA_NODE_HOST;
  const headRows = await getDb()
    .select({ port: heads.merchantApiPort })
    .from(heads)
    .orderBy(desc(heads.openedAt))
    .limit(1);
  const port = headRows[0]?.port;
  if (host && port && profile.address) {
    try {
      const r = await axios.get<Record<string, { address: string; value: { lovelace: number } }>>(
        `http://${host}:${port}/snapshot/utxo`,
        { validateStatus: () => true, timeout: 4000 },
      );
      if (r.status === 200 && r.data) {
        for (const u of Object.values(r.data)) {
          if (u.address === profile.address) {
            l2_lovelace += Number(u.value.lovelace ?? 0);
            l2_utxo_count++;
          }
        }
      }
    } catch {}
  }

  res.status(200).json({ profile, l1_lovelace, l1_utxos, l2_lovelace, l2_utxo_count });
}
