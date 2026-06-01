import { and, eq } from "drizzle-orm";

import { getDb } from "~/server/db/client";
import { headKeys, type HeadKey, type NewHeadKey } from "~/server/db/schema";

export async function createHeadKey(input: NewHeadKey): Promise<HeadKey> {
  const [row] = await getDb().insert(headKeys).values(input).returning();
  if (!row) throw new Error("Failed to insert head_keys row");
  return row;
}

export async function getHeadKeys(headId: string): Promise<HeadKey[]> {
  return getDb().select().from(headKeys).where(eq(headKeys.headId, headId));
}

export async function getHeadKeyByRole(
  headId: string,
  role: "merchant" | "customer",
): Promise<HeadKey | null> {
  const rows = await getDb()
    .select()
    .from(headKeys)
    .where(and(eq(headKeys.headId, headId), eq(headKeys.role, role)))
    .limit(1);
  return rows[0] ?? null;
}
