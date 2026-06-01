import type { NextApiRequest, NextApiResponse } from "next";

import { getIntentByTxId } from "~/server/intents";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const tx = typeof req.query.tx === "string" ? req.query.tx : null;
  if (!tx) return res.status(400).json({ error: "missing tx" });
  if (req.method !== "GET") return res.status(405).json({ error: "Method Not Allowed" });
  const intent = getIntentByTxId(tx);
  if (!intent) return res.status(404).json({ error: "intent not found" });
  return res.status(200).json({ intent });
}
