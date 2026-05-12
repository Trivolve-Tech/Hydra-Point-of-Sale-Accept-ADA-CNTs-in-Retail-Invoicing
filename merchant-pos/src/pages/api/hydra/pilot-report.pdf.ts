import type { NextApiRequest, NextApiResponse } from "next";
import { getMetricsCollector } from "~/server/hydra/metrics";
import { listFeedback } from "~/server/hydra/feedback-store";
import { buildPilotReportPdf } from "~/server/pilot-report";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  const metrics = getMetricsCollector().getSummary();
  const feedback = listFeedback();
  const pdf = await buildPilotReportPdf(metrics, feedback);

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader(
    "Content-Disposition",
    `inline; filename="hydra-pilot-report-${new Date().toISOString().slice(0, 10)}.pdf"`,
  );
  res.status(200).send(pdf);
}
