import type { NextApiRequest, NextApiResponse } from "next";
import { z } from "zod";

import { createCustomer } from "~/server/customers";
import { openHeadForCustomer } from "~/server/orchestrator/lifecycle";

const BodySchema = z.object({
  label: z.string().min(1).max(200).optional(),
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  const parsed = BodySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.message });
  }

  try {
    // v1 fully custodial: orchestrator generates both keypairs server-side,
    // inserts customer + head + head_keys rows, renders + spawns the per-head
    // Compose stack, and sends Init via WebSocket. The customer row is created
    // first with placeholder VKs that the orchestrator later updates with the
    // actual customer-side public keys it generated.
    const customer = await createCustomer({
      label: parsed.data.label,
      // VKs are placeholders here and will be the same values as customer-side
      // head_keys row populated by openHeadForCustomer.
      hydraVk: "pending",
      cardanoVk: "pending",
    });
    const head = await openHeadForCustomer({ customerId: customer.id });
    return res.status(200).json({ customer, head });
  } catch (e) {
    return res
      .status(500)
      .json({ error: e instanceof Error ? e.message : "enrollment failed" });
  }
}
