import type { NextApiRequest, NextApiResponse } from "next";

import { findProfileByOwner } from "~/server/customer-profile";

/**
 * GET /api/customers/by-wallet?owner=<stake or payment addr>
 * Returns the profile bound to that owner, or 404 if none.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method Not Allowed" });
  const owner = typeof req.query.owner === "string" ? req.query.owner : null;
  if (!owner) return res.status(400).json({ error: "missing owner" });
  const profile = await findProfileByOwner(owner);
  if (!profile) return res.status(404).json({ error: "no profile for owner" });
  return res.status(200).json({ profile });
}
