import type { NextApiRequest, NextApiResponse } from "next";
import { z } from "zod";

import { createDecommit } from "~/server/decommits";
import { getHeadById } from "~/server/heads";
import { makeHydraHttpClient } from "~/server/hydra/registry";

const BodySchema = z.object({
  decommitTx: z.record(z.string(), z.unknown()),
  amount_lovelace: z.string().regex(/^\d+$/).optional(),
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
    const resp = await client.postDecommit({ decommitTx: parsed.data.decommitTx });
    const decommit = await createDecommit({
      headId: id,
      amountLovelace: parsed.data.amount_lovelace ? BigInt(parsed.data.amount_lovelace) : 0n,
      status: "submitted",
    });
    return res.status(200).json({ decommit, response: resp.data });
  } catch (e) {
    return res
      .status(502)
      .json({ error: e instanceof Error ? e.message : "decommit failed" });
  }
}
