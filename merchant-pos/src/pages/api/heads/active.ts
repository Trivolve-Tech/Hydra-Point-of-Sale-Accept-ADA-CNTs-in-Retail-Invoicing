import type { NextApiRequest, NextApiResponse } from "next";
import { desc } from "drizzle-orm";

import { getDb } from "~/server/db/client";
import { heads } from "~/server/db/schema";
import { makeHydraHttpClient } from "~/server/hydra/registry";

export default async function handler(_req: NextApiRequest, res: NextApiResponse) {
  const rows = await getDb()
    .select()
    .from(heads)
    .orderBy(desc(heads.openedAt))
    .limit(1);
  const head = rows[0];
  if (!head) {
    return res.status(404).json({ error: "no head opened yet" });
  }

  const client = await makeHydraHttpClient(head.id);
  let hydraState: unknown = null;
  let snapshotUtxo: unknown = null;
  let snapshotErr: string | null = null;
  if (client) {
    try {
      const r = await client.getHeadState();
      hydraState = r.data;
    } catch (e) {
      snapshotErr = e instanceof Error ? e.message : "head state unreachable";
    }
    try {
      const r = await client.getSnapshotUtxo();
      snapshotUtxo = r.data;
    } catch {
      // snapshot UTxO is null until the head is Open
    }
  }

  res.status(200).json({ head, hydra: hydraState, snapshotUtxo, error: snapshotErr });
}
