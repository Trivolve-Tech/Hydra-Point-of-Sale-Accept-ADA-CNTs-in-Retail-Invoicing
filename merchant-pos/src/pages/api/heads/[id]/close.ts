import type { NextApiRequest, NextApiResponse } from "next";

import { closeHead } from "~/server/orchestrator/lifecycle";

// Admin-gated in a production deployment (Phase H). For v1 this is unauthenticated
// because the operator runs pos themselves; harden before exposing publicly.
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  const id = typeof req.query.id === "string" ? req.query.id : null;
  if (!id) return res.status(400).json({ error: "missing id" });

  try {
    await closeHead(id);
    return res.status(200).json({ ok: true });
  } catch (e) {
    return res
      .status(500)
      .json({ error: e instanceof Error ? e.message : "close failed" });
  }
}
