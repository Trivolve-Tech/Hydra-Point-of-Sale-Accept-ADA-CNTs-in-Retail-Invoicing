import type { NextApiRequest, NextApiResponse } from "next";
import z from "zod";

import { createNewTx, getTransactionRef, updateTransactionRef } from "~/server";
import {
  cardanoscanTxUrl,
  checkPaymentOnchain,
  resolvePrimaryFundingTxHash,
} from "~/server/cardano";
import { getMetricsCollector } from "~/server/hydra/metrics";

const BodySchema = z.object({
  amount: z.number(),
  prefer_hydra: z.boolean().optional().default(true),
});

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method === "POST") {
    const { amount, prefer_hydra } = BodySchema.parse(req.body);

    if (typeof amount !== "number" || amount <= 0) {
      return res.status(400).json({ error: "Invalid amount" });
    }

    const transactionData = await createNewTx(amount, prefer_hydra);

    res.status(200).json(transactionData);
  } else if (req.method === "GET") {
    const { tx } = req.query;

    if (!tx || typeof tx !== "string") {
      return res.status(400).json({ error: "Transaction ID is required" });
    }

    const transactionData = await getTransactionRef(tx);

    if (!transactionData) {
      return res.status(404).json({ error: "Transaction data not found" });
    }

    if (
      transactionData.settlement_layer === "L2" &&
      transactionData.hydra_status === "confirmed"
    ) {
      return res.status(200).json({
        ...transactionData,
        status: 1,
        onchain_tx_hash: transactionData.hydra_tx_id ?? null,
        cardanoscan_tx_url: null,
      });
    }

    const status = await checkPaymentOnchain(
      transactionData.payment_address,
      transactionData.amount,
    );

    let onchain_tx_hash: string | null = null;
    let cardanoscan_tx_url: string | null = null;
    if (status === 1) {
      onchain_tx_hash = await resolvePrimaryFundingTxHash(
        transactionData.payment_address,
      );
      if (onchain_tx_hash) {
        cardanoscan_tx_url = cardanoscanTxUrl(onchain_tx_hash);
      }
      const layer = transactionData.settlement_layer ?? "L1";
      const alreadyConfirmed = transactionData.hydra_status === "confirmed" ||
        transactionData.hydra_confirmed_at;
      if (!alreadyConfirmed && transactionData.created_at) {
        const elapsed = Date.now() - new Date(transactionData.created_at).getTime();
        getMetricsCollector().recordPaymentConfirmed(
          transactionData.tx_id,
          layer as "L1" | "L2",
          elapsed,
        );
        void updateTransactionRef(transactionData.tx_id, {
          hydra_confirmed_at: new Date().toISOString(),
        });
      }
    }

    res.status(200).json({
      ...transactionData,
      status,
      onchain_tx_hash,
      cardanoscan_tx_url,
    });
  } else {
    res.status(405).json({ error: "Method Not Allowed" });
  }
}
