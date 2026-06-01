import { desc, eq } from "drizzle-orm";

import { getDb } from "~/server/db/client";
import { customers, type Customer, type NewCustomer } from "~/server/db/schema";

export type CreateCustomerInput = {
  label?: string;
  hydraVk: string;
  cardanoVk: string;
  metadata?: Record<string, unknown>;
};

export async function createCustomer(input: CreateCustomerInput): Promise<Customer> {
  const insert: NewCustomer = {
    label: input.label,
    hydraVk: input.hydraVk,
    cardanoVk: input.cardanoVk,
    metadata: input.metadata ?? null,
    status: "active",
  };
  const [row] = await getDb().insert(customers).values(insert).returning();
  if (!row) throw new Error("Failed to insert customer row");
  return row;
}

export async function getCustomerById(id: string): Promise<Customer | null> {
  const rows = await getDb().select().from(customers).where(eq(customers.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function listCustomers(limit = 100): Promise<Customer[]> {
  return getDb().select().from(customers).orderBy(desc(customers.enrolledAt)).limit(limit);
}

export async function updateCustomer(
  id: string,
  patch: Partial<Pick<NewCustomer, "label" | "status" | "metadata">>,
): Promise<Customer | null> {
  const [row] = await getDb()
    .update(customers)
    .set(patch)
    .where(eq(customers.id, id))
    .returning();
  return row ?? null;
}
