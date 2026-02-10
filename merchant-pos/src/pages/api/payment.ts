import type { NextApiRequest, NextApiResponse } from "next";
import z from "zod";

import { createNewTx, getTransactionRef } from "~/server";
import { checkPaymentOnchain } from "~/server/cardano";

const BodySchema = z.object({ amount: z.number() });

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method === "POST") {
    const { amount } = BodySchema.parse(req.body);

    if (typeof amount !== "number" || amount <= 0) {
      return res.status(400).json({ error: "Invalid amount" });
    }

    const transactionData = await createNewTx(amount);

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

    const status = await checkPaymentOnchain(
      transactionData?.payment_address,
      transactionData.amount,
    );

    res.status(200).json({ status, ...transactionData });
  } else {
    res.status(405).json({ error: "Method Not Allowed" });
  }
}
