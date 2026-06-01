import { eq } from "drizzle-orm";

import { getDb } from "~/server/db/client";
import { heads, type Head, type NewHead } from "~/server/db/schema";

export async function createHead(input: NewHead): Promise<Head> {
  const [row] = await getDb().insert(heads).values(input).returning();
  if (!row) throw new Error("Failed to insert head row");
  return row;
}

export async function getHeadById(id: string): Promise<Head | null> {
  const rows = await getDb().select().from(heads).where(eq(heads.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function listHeadsByCustomer(customerId: string): Promise<Head[]> {
  return getDb().select().from(heads).where(eq(heads.customerId, customerId));
}

export async function updateHead(
  id: string,
  patch: Partial<NewHead>,
): Promise<Head | null> {
  const [row] = await getDb()
    .update(heads)
    .set(patch)
    .where(eq(heads.id, id))
    .returning();
  return row ?? null;
}
