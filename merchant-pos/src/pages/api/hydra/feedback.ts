import type { NextApiRequest, NextApiResponse } from "next";
import z from "zod";
import { addFeedback, listFeedback } from "~/server/hydra/feedback-store";

const FeedbackSchema = z.object({
  rating: z.number().min(1).max(5),
  comments: z.string().min(1).max(2000),
  merchant_id: z.string().optional(),
});

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method === "POST") {
    const { rating, comments, merchant_id } = FeedbackSchema.parse(req.body);
    const entry = addFeedback(rating, comments, merchant_id);
    return res.status(201).json(entry);
  }

  if (req.method === "GET") {
    const entries = listFeedback();
    return res.status(200).json(entries);
  }

  res.status(405).json({ error: "Method Not Allowed" });
}
