import type { NextApiRequest, NextApiResponse } from "next";
import { z } from "zod";

import { DEV_HEAD_ID, getHydraRegistry } from "~/server/hydra/registry";

const BodySchema = z.object({
  cbor_hex: z.string(),
  head_id: z.string().optional(),
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  const parsed = BodySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.message });
  }

  const headId = parsed.data.head_id ?? DEV_HEAD_ID;
  const router = await getHydraRegistry().getRouter(headId);
  if (!router) {
    return res.status(503).json({
      success: false,
      error: `Hydra head '${headId}' not available`,
      fallback: "L1",
    });
  }

  const result = await router.submitL2Transaction(parsed.data.cbor_hex);
  return res.status(200).json(result);
}
