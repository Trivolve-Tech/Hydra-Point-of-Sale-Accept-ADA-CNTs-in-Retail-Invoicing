import { desc, eq } from "drizzle-orm";

import { getDb } from "~/server/db/client";
import { deposits, type Deposit, type NewDeposit } from "~/server/db/schema";

export async function createDeposit(input: NewDeposit): Promise<Deposit> {
  const [row] = await getDb().insert(deposits).values(input).returning();
  if (!row) throw new Error("Failed to insert deposit row");
  return row;
}

export async function getDepositById(id: string): Promise<Deposit | null> {
  const rows = await getDb().select().from(deposits).where(eq(deposits.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function listDepositsForHead(headId: string): Promise<Deposit[]> {
  return getDb()
    .select()
    .from(deposits)
    .where(eq(deposits.headId, headId))
    .orderBy(desc(deposits.requestedAt));
}

export async function updateDeposit(
  id: string,
  patch: Partial<NewDeposit>,
): Promise<Deposit | null> {
  const [row] = await getDb().update(deposits).set(patch).where(eq(deposits.id, id)).returning();
  return row ?? null;
}
