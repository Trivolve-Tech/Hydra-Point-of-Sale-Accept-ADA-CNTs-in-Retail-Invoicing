import type { NextApiRequest, NextApiResponse } from "next";
import z from "zod";
import { createNewTx } from "~/server";
import axios from "axios";

const BodySchema = z.object({
  amount: z.number().positive(),
  prefer_hydra: z.boolean().default(true),
  link_invoice: z.boolean().default(false),
  customer: z
    .object({
      name: z.string().optional(),
      email: z.string().optional(),
    })
    .optional(),
  notes: z.string().optional(),
});

const INVOICE_BACKEND =
  process.env.INVOICE_BACKEND_URL ?? "http://localhost:7071";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  const body = BodySchema.parse(req.body);
  const intent = await createNewTx(body.amount, body.prefer_hydra);

  let invoice = undefined;

  if (body.link_invoice) {
    try {
      const lovelace = Math.round(body.amount * 1_000_000).toString();
      const { data } = await axios.post(`${INVOICE_BACKEND}/invoices`, {
        status: "pending_payment",
        asset: { unit: "lovelace", quantity: lovelace },
        customer: body.customer,
        notes: body.notes,
        reference: intent.tx_id,
        metadata: {
          payment_address: intent.payment_address,
          settlement_layer: intent.settlement_layer,
        },
      });
      invoice = data;
    } catch {
      // invoice creation is optional — don't fail the intent
    }
  }

  res.status(200).json({ intent, invoice });
}
