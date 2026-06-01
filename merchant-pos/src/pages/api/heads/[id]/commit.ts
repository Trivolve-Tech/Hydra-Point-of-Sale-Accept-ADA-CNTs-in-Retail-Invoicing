import type { NextApiRequest, NextApiResponse } from "next";
import { z } from "zod";

import { createDeposit } from "~/server/deposits";
import { getHeadById } from "~/server/heads";
import { makeHydraHttpClient } from "~/server/hydra/registry";

// POST body mirrors hydra-node's /commit shape: either a `utxo` object to
// commit, or a `blueprintTx` + `utxo` for advanced flows. We forward as-is
// and persist a `deposits` row so we can track lifecycle.
const BodySchema = z.object({
  utxo: z.record(z.string(), z.unknown()),
  blueprintTx: z.record(z.string(), z.unknown()).optional(),
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  const id = typeof req.query.id === "string" ? req.query.id : null;
  if (!id) return res.status(400).json({ error: "missing id" });

  const head = await getHeadById(id);
  if (!head) return res.status(404).json({ error: "head not found" });

  const parsed = BodySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.message });
  }

  const client = await makeHydraHttpClient(id);
  if (!client) {
    return res.status(503).json({ error: "hydra-node not reachable for this head" });
  }

  try {
    const resp = await client.postCommit(parsed.data);
    // Tally the lovelace being committed so we can track it on-chain after the
    // caller signs and submits.
    const amountLovelace = sumLovelace(parsed.data.utxo);
    const deposit = await createDeposit({
      headId: id,
      amountLovelace,
      status: "drafted",
    });
    return res.status(200).json({ deposit, draftTx: resp.data });
  } catch (e) {
    return res
      .status(502)
      .json({ error: e instanceof Error ? e.message : "commit failed" });
  }
}

function sumLovelace(utxoMap: Record<string, unknown>): bigint {
  let acc = 0n;
  for (const v of Object.values(utxoMap)) {
    if (!v || typeof v !== "object") continue;
    const value = (v as { value?: Record<string, unknown> }).value;
    const lovelace = value?.lovelace;
    if (typeof lovelace === "number") acc += BigInt(lovelace);
    else if (typeof lovelace === "string" && /^\d+$/.test(lovelace)) acc += BigInt(lovelace);
  }
  return acc;
}
