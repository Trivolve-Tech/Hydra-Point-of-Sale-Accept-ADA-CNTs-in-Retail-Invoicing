import type { NextApiRequest, NextApiResponse } from "next";
import { z } from "zod";

import { createIntent, listIntents } from "~/server/intents";

const Body = z.object({
  amount_lovelace: z.string().regex(/^\d+$/),
  reference: z.string().max(120).optional(),
  customer_name: z.string().max(120).optional(),
  customer_email: z.string().max(160).optional(),
  notes: z.string().max(400).optional(),
  customer_id: z.string().uuid().optional(),
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === "GET") {
    return res.status(200).json({ intents: listIntents() });
  }
  if (req.method === "POST") {
    const parsed = Body.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.message });
    const intent = createIntent(parsed.data);
    return res.status(200).json({ intent });
  }
  return res.status(405).json({ error: "Method Not Allowed" });
}
