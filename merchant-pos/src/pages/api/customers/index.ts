import type { NextApiRequest, NextApiResponse } from "next";
import { z } from "zod";
import axios from "axios";

import { createProfile, findProfileByOwner, listProfiles } from "~/server/customer-profile";
import { desc } from "drizzle-orm";
import { getDb } from "~/server/db/client";
import { heads } from "~/server/db/schema";

const BF_BASE = process.env.BLOCKFROST_URL ?? "https://cardano-mainnet.blockfrost.io/api/v0";
const BF_KEY = process.env.BLOCKFROST_KEY;

const Body = z.object({
  label: z.string().max(120).optional(),
  /** Stake (or first used) address — stable wallet identifier; idempotency key. */
  owner_address: z.string().max(200),
  /** The wallet's base address — where L1+L2 UTxOs live for this user. */
  wallet_address: z.string().max(200),
});

type AddrAmount = { unit: string; quantity: string };

async function l1Lovelace(addr: string): Promise<number> {
  if (!BF_KEY || !addr) return 0;
  try {
    const r = await axios.get<{ amount: AddrAmount[] }>(
      `${BF_BASE}/addresses/${addr}`,
      { headers: { project_id: BF_KEY }, validateStatus: () => true },
    );
    if (r.status !== 200) return 0;
    return Number(r.data.amount?.find((a) => a.unit === "lovelace")?.quantity ?? "0");
  } catch {
    return 0;
  }
}

async function activeHeadPort(): Promise<number | null> {
  const rows = await getDb()
    .select({ port: heads.merchantApiPort })
    .from(heads)
    .orderBy(desc(heads.openedAt))
    .limit(1);
  return rows[0]?.port ?? null;
}

async function l2LovelaceAt(addr: string, port: number | null): Promise<number> {
  const host = process.env.HYDRA_NODE_HOST;
  if (!host || !addr || !port) return 0;
  try {
    const r = await axios.get<Record<string, { address: string; value: { lovelace: number } }>>(
      `http://${host}:${port}/snapshot/utxo`,
      { validateStatus: () => true, timeout: 4000 },
    );
    if (r.status !== 200 || !r.data) return 0;
    let acc = 0;
    for (const u of Object.values(r.data)) {
      if (u.address === addr) acc += Number(u.value.lovelace ?? 0);
    }
    return acc;
  } catch {
    return 0;
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === "POST") {
    const parsed = Body.safeParse(req.body ?? {});
    if (!parsed.success) return res.status(400).json({ error: parsed.error.message });

    // Idempotent — return existing profile for this owner if any.
    const existing = await findProfileByOwner(parsed.data.owner_address);
    if (existing) return res.status(200).json({ profile: existing });

    const profile = await createProfile({
      walletAddress: parsed.data.wallet_address,
      ownerAddress: parsed.data.owner_address,
      label: parsed.data.label,
    });
    return res.status(200).json({ profile });
  }

  if (req.method === "GET") {
    const profiles = await listProfiles();
    const port = await activeHeadPort();
    const withBalances = await Promise.all(
      profiles.map(async (p) => {
        const [l1, l2] = await Promise.all([l1Lovelace(p.address), l2LovelaceAt(p.address, port)]);
        return { ...p, l1_lovelace: l1, l2_lovelace: l2 };
      }),
    );
    return res.status(200).json({ profiles: withBalances });
  }

  return res.status(405).json({ error: "Method Not Allowed" });
}
