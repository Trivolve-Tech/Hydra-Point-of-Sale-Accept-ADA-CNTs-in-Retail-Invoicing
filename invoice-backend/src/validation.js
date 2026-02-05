import { z } from "zod";

export const AssetSchema = z.object({
  /**
   * "lovelace" for ADA, or "<policyId>.<assetNameHex>" for CNTs
   * (kept generic to fit multiple wallet/indexer conventions).
   */
  unit: z.string().min(1),
  /**
   * Base unit quantity as a decimal string to avoid JS float issues.
   * - ADA: lovelace quantity (e.g. "1500000" for 1.5 ADA)
   * - CNT: smallest unit quantity per token definition
   */
  quantity: z.string().regex(/^\d+$/),
});

export const InvoiceStatusSchema = z.enum([
  "draft",
  "issued",
  "pending_payment",
  "paid",
  "expired",
  "cancelled",
  "failed",
]);

export const CustomerSchema = z
  .object({
    name: z.string().min(1).optional(),
    email: z.string().email().optional(),
    phone: z.string().min(3).optional(),
  })
  .optional();

export const LineItemSchema = z.object({
  description: z.string().min(1),
  quantity: z.number().positive().default(1),
  unit_price: z.string().regex(/^\d+$/), // base units (same unit as invoice asset)
});

export const CreateInvoiceBodySchema = z.object({
  number: z.string().min(1).optional(),
  reference: z.string().min(1).optional(),
  status: InvoiceStatusSchema.default("issued"),
  asset: AssetSchema,
  line_items: z.array(LineItemSchema).default([]),
  customer: CustomerSchema,
  notes: z.string().max(5000).optional(),
  expiry_at: z.string().datetime().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export const UpdateInvoiceBodySchema = CreateInvoiceBodySchema.partial().extend({
  status: InvoiceStatusSchema.optional(),
});

export function computeTotal(asset, lineItems) {
  if (!lineItems?.length) return asset.quantity;
  const total = lineItems.reduce((acc, li) => {
    const liTotal = BigInt(li.unit_price) * BigInt(Math.round(li.quantity));
    return acc + liTotal;
  }, 0n);
  return total.toString();
}

