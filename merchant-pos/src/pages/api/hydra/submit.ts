import type { NextApiRequest, NextApiResponse } from "next";
import z from "zod";
import { getTransactionRef, updateTransactionRef } from "~/server";
import { getHydraRouter } from "~/server/hydra/singleton";
import { getMetricsCollector } from "~/server/hydra/metrics";

const BodySchema = z.object({
  tx_id: z.string(),
  cbor_hex: z.string(),
});

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  const { tx_id, cbor_hex } = BodySchema.parse(req.body);

  const record = await getTransactionRef(tx_id);
  if (!record) {
    return res.status(404).json({ error: "Payment record not found" });
  }

  if (record.settlement_layer !== "L2") {
    return res.status(400).json({ error: "Payment is not configured for L2 settlement" });
  }

  const router = getHydraRouter();
  const metrics = getMetricsCollector();

  if (!router) {
    await updateTransactionRef(tx_id, {
      hydra_status: "failed",
      l1_fallback_reason: "Hydra not configured",
    });
    metrics.recordL2Fallback(tx_id, "Hydra not configured");
    return res.status(503).json({
      success: false,
      error: "Hydra not configured",
      fallback: "L1",
    });
  }

  const submitStart = Date.now();
  const result = await router.submitL2Transaction(cbor_hex);

  if (result.success) {
    const confirmationTimeMs = Date.now() - submitStart;
    await updateTransactionRef(tx_id, {
      hydra_status: "confirmed",
      hydra_tx_id: result.transactionId,
      hydra_confirmed_at: new Date().toISOString(),
    });
    metrics.recordPaymentConfirmed(tx_id, "L2", confirmationTimeMs);
    return res.status(200).json({ success: true, transactionId: result.transactionId });
  }

  await updateTransactionRef(tx_id, {
    hydra_status: "failed",
    l1_fallback_reason: result.error ?? "L2 submission failed",
  });
  metrics.recordL2Fallback(tx_id, result.error ?? "L2 submission failed");

  return res.status(200).json({
    success: false,
    error: result.error,
    fallback: "L1",
  });
}
