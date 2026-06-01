import type { NextApiRequest, NextApiResponse } from "next";

import { DEV_HEAD_ID, makeHydraHttpClient } from "~/server/hydra/registry";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  const headId =
    typeof req.query.head_id === "string" ? req.query.head_id : DEV_HEAD_ID;
  const client = await makeHydraHttpClient(headId);
  if (!client) {
    return res.status(503).json({ error: `Hydra head '${headId}' not available` });
  }

  try {
    const resp = await client.getProtocolParameters();
    return res.status(200).json(resp.data);
  } catch (e) {
    return res
      .status(502)
      .json({ error: e instanceof Error ? e.message : "hydra-node unreachable" });
  }
}
