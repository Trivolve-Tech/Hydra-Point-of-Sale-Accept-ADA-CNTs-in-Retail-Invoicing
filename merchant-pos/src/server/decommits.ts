import { desc, eq } from "drizzle-orm";

import { getDb } from "~/server/db/client";
import { decommits, type Decommit, type NewDecommit } from "~/server/db/schema";

export async function createDecommit(input: NewDecommit): Promise<Decommit> {
  const [row] = await getDb().insert(decommits).values(input).returning();
  if (!row) throw new Error("Failed to insert decommit row");
  return row;
}

export async function getDecommitById(id: string): Promise<Decommit | null> {
  const rows = await getDb().select().from(decommits).where(eq(decommits.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function listDecommitsForHead(headId: string): Promise<Decommit[]> {
  return getDb()
    .select()
    .from(decommits)
    .where(eq(decommits.headId, headId))
    .orderBy(desc(decommits.requestedAt));
}

export async function updateDecommit(
  id: string,
  patch: Partial<NewDecommit>,
): Promise<Decommit | null> {
  const [row] = await getDb().update(decommits).set(patch).where(eq(decommits.id, id)).returning();
  return row ?? null;
}
