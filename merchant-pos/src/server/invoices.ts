import { desc, eq } from "drizzle-orm";
import { nanoid } from "nanoid";

import { getDb } from "~/server/db/client";
import {
  invoices,
  type Invoice,
  type NewInvoice,
} from "~/server/db/schema";

export type InvoiceAsset = { unit: string; quantity: string };

export type LineItem = {
  description: string;
  quantity: number;
  unit_price: string;
};

export type CreateInvoiceInput = {
  number?: string;
  reference?: string;
  customerId?: string;
  status?: NewInvoice["status"];
  asset: InvoiceAsset;
  lineItems?: LineItem[];
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
  notes?: string;
  metadata?: Record<string, unknown>;
  expiryAt?: Date | null;
};

export type UpdateInvoiceInput = Partial<{
  status: NewInvoice["status"];
  paidAt: Date | null;
  reference: string | null;
  notes: string | null;
  metadata: Record<string, unknown> | null;
}>;

export async function createInvoice(input: CreateInvoiceInput): Promise<Invoice> {
  const number = input.number ?? generateInvoiceNumber();
  const insert: NewInvoice = {
    number,
    reference: input.reference,
    customerId: input.customerId ?? null,
    status: input.status ?? "issued",
    assetUnit: input.asset.unit,
    assetQuantity: computeTotal(input.asset.quantity, input.lineItems ?? []),
    lineItems: input.lineItems ?? [],
    customerName: input.customerName,
    customerEmail: input.customerEmail,
    customerPhone: input.customerPhone,
    notes: input.notes,
    metadata: input.metadata ?? null,
    expiryAt: input.expiryAt ?? null,
  };
  const [row] = await getDb().insert(invoices).values(insert).returning();
  if (!row) throw new Error("Failed to insert invoice row");
  return row;
}

export async function getInvoiceById(id: string): Promise<Invoice | null> {
  const rows = await getDb().select().from(invoices).where(eq(invoices.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function getInvoiceByNumber(number: string): Promise<Invoice | null> {
  const rows = await getDb().select().from(invoices).where(eq(invoices.number, number)).limit(1);
  return rows[0] ?? null;
}

export async function listInvoices(limit = 100): Promise<Invoice[]> {
  return getDb().select().from(invoices).orderBy(desc(invoices.createdAt)).limit(limit);
}

export async function updateInvoice(
  id: string,
  patch: UpdateInvoiceInput,
): Promise<Invoice | null> {
  const [row] = await getDb()
    .update(invoices)
    .set({
      ...(patch.status !== undefined && { status: patch.status }),
      ...(patch.paidAt !== undefined && { paidAt: patch.paidAt }),
      ...(patch.reference !== undefined && { reference: patch.reference }),
      ...(patch.notes !== undefined && { notes: patch.notes }),
      ...(patch.metadata !== undefined && { metadata: patch.metadata }),
    })
    .where(eq(invoices.id, id))
    .returning();
  return row ?? null;
}

// `total = asset.quantity` when no line items, else sum of `unit_price * quantity`
// computed in BigInt to avoid float precision loss on large CNT amounts.
function computeTotal(fallback: string, items: LineItem[]): string {
  if (items.length === 0) return fallback;
  let acc = 0n;
  for (const li of items) {
    acc += BigInt(li.unit_price) * BigInt(Math.round(li.quantity));
  }
  return acc.toString();
}

function generateInvoiceNumber(): string {
  const datePart = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  return `INV-${datePart}-${nanoid(6)}`;
}
