import { and, desc, eq } from "drizzle-orm";

import { getDb } from "~/server/db/client";
import {
  payments,
  type NewPayment,
  type Payment,
} from "~/server/db/schema";

export type CreatePaymentInput = {
  amountLovelace: bigint;
  settlementLayer: "L1" | "L2";
  headId?: string | null;
  invoiceId?: string | null;
};

export type UpdatePaymentInput = Partial<{
  status: "pending" | "submitted" | "confirmed" | "failed";
  inHeadTxId: string | null;
  confirmedAt: Date | null;
  l1FallbackReason: string | null;
  headId: string | null;
}>;

export async function createPayment(input: CreatePaymentInput): Promise<Payment> {
  const insert: NewPayment = {
    amountLovelace: input.amountLovelace,
    settlementLayer: input.settlementLayer,
    headId: input.headId ?? null,
    invoiceId: input.invoiceId ?? null,
  };
  const [row] = await getDb().insert(payments).values(insert).returning();
  if (!row) throw new Error("Failed to insert payment row");
  return row;
}

export async function getPaymentById(id: string): Promise<Payment | null> {
  const rows = await getDb().select().from(payments).where(eq(payments.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function updatePayment(
  id: string,
  patch: UpdatePaymentInput,
): Promise<Payment | null> {
  const [row] = await getDb()
    .update(payments)
    .set({
      ...(patch.status !== undefined && { status: patch.status }),
      ...(patch.inHeadTxId !== undefined && { inHeadTxId: patch.inHeadTxId }),
      ...(patch.confirmedAt !== undefined && { confirmedAt: patch.confirmedAt }),
      ...(patch.l1FallbackReason !== undefined && {
        l1FallbackReason: patch.l1FallbackReason,
      }),
      ...(patch.headId !== undefined && { headId: patch.headId }),
    })
    .where(eq(payments.id, id))
    .returning();
  return row ?? null;
}

export async function listPaymentsForHead(headId: string): Promise<Payment[]> {
  return getDb()
    .select()
    .from(payments)
    .where(eq(payments.headId, headId))
    .orderBy(desc(payments.createdAt));
}

export async function listPaymentsForInvoice(invoiceId: string): Promise<Payment[]> {
  return getDb()
    .select()
    .from(payments)
    .where(eq(payments.invoiceId, invoiceId))
    .orderBy(desc(payments.createdAt));
}

export async function findConfirmedForInvoice(invoiceId: string): Promise<Payment | null> {
  const rows = await getDb()
    .select()
    .from(payments)
    .where(and(eq(payments.invoiceId, invoiceId), eq(payments.status, "confirmed")))
    .limit(1);
  return rows[0] ?? null;
}
