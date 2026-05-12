import PDFDocument from "pdfkit";
import type { MetricsSummary } from "./hydra/metrics";
import type { FeedbackEntry } from "./hydra/feedback-store";

export function buildPilotReportPdf(
  metrics: MetricsSummary,
  feedback: FeedbackEntry[],
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 50 });
    const chunks: Buffer[] = [];

    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    doc
      .fontSize(22)
      .font("Helvetica-Bold")
      .text("Hydra PoS Pilot Report", { align: "center" });
    doc.moveDown(0.5);
    doc
      .fontSize(10)
      .font("Helvetica")
      .text(`Generated: ${new Date().toISOString()}`, { align: "center" });
    doc.moveDown(1.5);

    section(doc, "1. Executive Summary");
    doc.text(
      `This report summarizes the merchant pilot of the Hydra Layer-2 payment integration ` +
      `for the Cardano Point-of-Sale system. During the pilot period, ${metrics.total_payments} ` +
      `payment(s) were initiated: ${metrics.total_l2} via Hydra L2 and ${metrics.total_l1} via ` +
      `Cardano L1. ${metrics.fallback_count} fallback(s) from L2 to L1 occurred.`,
    );
    doc.moveDown();

    section(doc, "2. Transaction Speed Benchmarks");
    table(doc, [
      ["Metric", "L2 (Hydra)", "L1 (On-chain)"],
      ["Payments created", String(metrics.total_l2), String(metrics.total_l1)],
      ["Payments confirmed", String(metrics.l2_confirmed), String(metrics.l1_confirmed)],
      [
        "Avg confirmation (ms)",
        metrics.avg_l2_confirmation_ms != null ? String(metrics.avg_l2_confirmation_ms) : "N/A",
        metrics.avg_l1_confirmation_ms != null ? String(metrics.avg_l1_confirmation_ms) : "N/A",
      ],
    ]);
    doc.moveDown();

    section(doc, "3. Stability Metrics");
    doc.text(`Fallback events: ${metrics.fallback_count}`);
    if (Object.keys(metrics.fallback_reasons).length > 0) {
      doc.text("Fallback reasons:");
      for (const [reason, count] of Object.entries(metrics.fallback_reasons)) {
        doc.text(`  - ${reason}: ${count}`, { indent: 20 });
      }
    }
    doc.text(`Hydra connection events: ${metrics.connection_events}`);
    if (metrics.first_event_at) {
      doc.text(`Pilot period: ${metrics.first_event_at} to ${metrics.last_event_at}`);
    }
    doc.moveDown();

    section(doc, "4. UX Feedback Summary");
    if (feedback.length === 0) {
      doc.text("No feedback collected yet.");
    } else {
      const avgRating =
        feedback.reduce((sum, f) => sum + f.rating, 0) / feedback.length;
      doc.text(`Total responses: ${feedback.length}`);
      doc.text(`Average rating: ${avgRating.toFixed(1)} / 5`);
      doc.moveDown(0.5);

      for (const f of feedback.slice(0, 20)) {
        doc
          .font("Helvetica-Bold")
          .text(`[${f.rating}/5] ${f.merchant_id ?? "Anonymous"}`, { continued: true })
          .font("Helvetica")
          .text(` — ${f.comments}`);
      }
      if (feedback.length > 20) {
        doc.text(`... and ${feedback.length - 20} more responses.`);
      }
    }
    doc.moveDown();

    section(doc, "5. Recommendations");
    doc.text(
      "Based on the pilot data, the following recommendations are made for production rollout:",
    );
    const recs = [
      "Monitor L2 head availability with automated health checks.",
      "Set up alerting on fallback frequency exceeding 5% of L2 attempts.",
      "Consider deploying multiple Hydra heads for high-traffic merchants.",
      "Collect additional merchant feedback on settlement speed perception.",
    ];
    for (const rec of recs) {
      doc.text(`  • ${rec}`, { indent: 10 });
    }

    doc.end();
  });
}

function section(doc: PDFKit.PDFDocument, title: string) {
  doc.fontSize(14).font("Helvetica-Bold").text(title);
  doc.moveDown(0.3);
  doc.fontSize(10).font("Helvetica");
}

function table(doc: PDFKit.PDFDocument, rows: string[][]) {
  const colWidth = 160;
  for (const row of rows) {
    const y = doc.y;
    for (let i = 0; i < row.length; i++) {
      doc.text(row[i]!, 50 + i * colWidth, y, { width: colWidth - 10 });
    }
    doc.y = y + 16;
  }
}
