import type { NextApiRequest, NextApiResponse } from "next";

import { getHeadById } from "~/server/heads";
import { makeHydraHttpClient } from "~/server/hydra/registry";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  const id = typeof req.query.id === "string" ? req.query.id : null;
  if (!id) return res.status(400).json({ error: "missing id" });

  const head = await getHeadById(id);
  if (!head) return res.status(404).json({ error: "head not found" });

  const client = await makeHydraHttpClient(id);
  if (!client) {
    return res.status(503).json({ error: "hydra-node not reachable for this head" });
  }

  try {
    const resp = await client.getHeadState();
    return res.status(200).json({ head, hydra: resp.data });
  } catch (e) {
    return res.status(502).json({
      head,
      hydra: null,
      error: e instanceof Error ? e.message : "hydra-node unreachable",
    });
  }
}
