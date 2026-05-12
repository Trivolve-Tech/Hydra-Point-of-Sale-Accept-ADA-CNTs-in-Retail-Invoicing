import type { NextApiRequest, NextApiResponse } from "next";
import { getMetricsCollector } from "~/server/hydra/metrics";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  const collector = getMetricsCollector();
  const summary = collector.getSummary();
  res.status(200).json(summary);
}
