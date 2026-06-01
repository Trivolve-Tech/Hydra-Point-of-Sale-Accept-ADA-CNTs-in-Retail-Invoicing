import {
  bigint,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

// ----- Enums -----

export const customerStatusEnum = pgEnum("customer_status", [
  "pending",
  "active",
  "suspended",
  "offboarded",
]);

export const headStateEnum = pgEnum("head_state", [
  "initializing",
  "open",
  "closed",
  "fanout_complete",
  "failed",
]);

export const partyRoleEnum = pgEnum("party_role", ["merchant", "customer"]);

export const depositStatusEnum = pgEnum("deposit_status", [
  "drafted",
  "submitted",
  "observed",
  "incremented",
  "finalized",
  "recovered",
  "failed",
]);

export const decommitStatusEnum = pgEnum("decommit_status", [
  "submitted",
  "approved",
  "finalized",
  "failed",
]);

export const paymentStatusEnum = pgEnum("payment_status", [
  "pending",
  "submitted",
  "confirmed",
  "failed",
]);

export const invoiceStatusEnum = pgEnum("invoice_status", [
  "draft",
  "issued",
  "pending_payment",
  "paid",
  "expired",
  "cancelled",
  "failed",
]);

export const settlementLayerEnum = pgEnum("settlement_layer", ["L1", "L2"]);

// ----- Tables -----

export const customers = pgTable(
  "customers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    label: varchar("label", { length: 200 }),
    hydraVk: text("hydra_vk").notNull(),
    cardanoVk: text("cardano_vk").notNull(),
    status: customerStatusEnum("status").notNull().default("pending"),
    enrolledAt: timestamp("enrolled_at", { withTimezone: true }).notNull().defaultNow(),
    metadata: jsonb("metadata"),
  },
  (t) => ({
    hydraVkIdx: uniqueIndex("customers_hydra_vk_idx").on(t.hydraVk),
  }),
);

export const invoices = pgTable(
  "invoices",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    number: varchar("number", { length: 60 }).notNull(),
    reference: varchar("reference", { length: 200 }),
    customerId: uuid("customer_id").references(() => customers.id, { onDelete: "set null" }),
    status: invoiceStatusEnum("status").notNull().default("issued"),
    // asset_unit = "lovelace" for ADA or "<policyId><assetNameHex>" for CNTs
    assetUnit: text("asset_unit").notNull(),
    // asset_quantity = base-unit string (matches Mesh / demo invoice convention)
    assetQuantity: text("asset_quantity").notNull(),
    lineItems: jsonb("line_items").notNull().default([]),
    customerName: varchar("customer_name", { length: 200 }),
    customerEmail: varchar("customer_email", { length: 320 }),
    customerPhone: varchar("customer_phone", { length: 40 }),
    notes: text("notes"),
    metadata: jsonb("metadata"),
    expiryAt: timestamp("expiry_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    paidAt: timestamp("paid_at", { withTimezone: true }),
  },
  (t) => ({
    numberIdx: uniqueIndex("invoices_number_idx").on(t.number),
    customerIdx: index("invoices_customer_idx").on(t.customerId),
    statusIdx: index("invoices_status_idx").on(t.status),
  }),
);

export const heads = pgTable(
  "heads",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    customerId: uuid("customer_id")
      .notNull()
      .references(() => customers.id, { onDelete: "restrict" }),
    // headIdChain is the on-chain Head identifier (script address / head token),
    // populated once the Init tx is observed on L1.
    headIdChain: text("head_id_chain"),
    state: headStateEnum("state").notNull().default("initializing"),
    merchantApiPort: integer("merchant_api_port").notNull(),
    merchantPeerPort: integer("merchant_peer_port").notNull(),
    customerApiPort: integer("customer_api_port").notNull(),
    customerPeerPort: integer("customer_peer_port").notNull(),
    contestationPeriodSeconds: integer("contestation_period_seconds").notNull(),
    openedAt: timestamp("opened_at", { withTimezone: true }),
    closedAt: timestamp("closed_at", { withTimezone: true }),
  },
  (t) => ({
    customerIdx: index("heads_customer_idx").on(t.customerId),
    stateIdx: index("heads_state_idx").on(t.state),
  }),
);

export const headKeys = pgTable(
  "head_keys",
  {
    headId: uuid("head_id")
      .notNull()
      .references(() => heads.id, { onDelete: "cascade" }),
    role: partyRoleEnum("role").notNull(),
    hydraVk: text("hydra_vk").notNull(),
    cardanoVk: text("cardano_vk").notNull(),
    // v1 (fully custodial): both keys held server-side; the orchestrator
    // populates the *_sk_path columns to filesystem paths under
    // infra/hydra/keys/<head_id>/.
    // v2 (strict non-custody, post-pilot): customer.hydra_sk_path is null;
    // signing happens client-side. See docs/ops/non-custody-spike.md.
    hydraSkPath: text("hydra_sk_path"),
    cardanoSkPath: text("cardano_sk_path"),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.headId, t.role] }),
  }),
);

export const deposits = pgTable(
  "deposits",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    headId: uuid("head_id")
      .notNull()
      .references(() => heads.id, { onDelete: "cascade" }),
    txHashL1: text("tx_hash_l1"),
    amountLovelace: bigint("amount_lovelace", { mode: "bigint" }).notNull(),
    status: depositStatusEnum("status").notNull().default("drafted"),
    requestedAt: timestamp("requested_at", { withTimezone: true }).notNull().defaultNow(),
    finalizedAt: timestamp("finalized_at", { withTimezone: true }),
    error: text("error"),
  },
  (t) => ({
    headIdx: index("deposits_head_idx").on(t.headId),
  }),
);

export const decommits = pgTable(
  "decommits",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    headId: uuid("head_id")
      .notNull()
      .references(() => heads.id, { onDelete: "cascade" }),
    txHashL1: text("tx_hash_l1"),
    amountLovelace: bigint("amount_lovelace", { mode: "bigint" }).notNull(),
    status: decommitStatusEnum("status").notNull().default("submitted"),
    requestedAt: timestamp("requested_at", { withTimezone: true }).notNull().defaultNow(),
    finalizedAt: timestamp("finalized_at", { withTimezone: true }),
    error: text("error"),
  },
  (t) => ({
    headIdx: index("decommits_head_idx").on(t.headId),
  }),
);

export const payments = pgTable(
  "payments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    headId: uuid("head_id").references(() => heads.id, { onDelete: "set null" }),
    invoiceId: uuid("invoice_id").references(() => invoices.id, { onDelete: "set null" }),
    amountLovelace: bigint("amount_lovelace", { mode: "bigint" }).notNull(),
    settlementLayer: settlementLayerEnum("settlement_layer").notNull(),
    status: paymentStatusEnum("status").notNull().default("pending"),
    inHeadTxId: text("in_head_tx_id"),
    l1FallbackReason: text("l1_fallback_reason"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    confirmedAt: timestamp("confirmed_at", { withTimezone: true }),
  },
  (t) => ({
    headIdx: index("payments_head_idx").on(t.headId),
    invoiceIdx: index("payments_invoice_idx").on(t.invoiceId),
    statusIdx: index("payments_status_idx").on(t.status),
  }),
);

export const hydraMetrics = pgTable(
  "hydra_metrics",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    headId: uuid("head_id").references(() => heads.id, { onDelete: "set null" }),
    kind: varchar("kind", { length: 80 }).notNull(),
    latencyMs: integer("latency_ms"),
    error: text("error"),
    details: jsonb("details"),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    occurredAtIdx: index("hydra_metrics_occurred_at_idx").on(t.occurredAt),
    headIdx: index("hydra_metrics_head_idx").on(t.headId),
  }),
);

// ----- Inferred row types (handy for service code) -----

export type Customer = typeof customers.$inferSelect;
export type NewCustomer = typeof customers.$inferInsert;
export type Invoice = typeof invoices.$inferSelect;
export type NewInvoice = typeof invoices.$inferInsert;
export type Head = typeof heads.$inferSelect;
export type NewHead = typeof heads.$inferInsert;
export type HeadKey = typeof headKeys.$inferSelect;
export type NewHeadKey = typeof headKeys.$inferInsert;
export type Deposit = typeof deposits.$inferSelect;
export type NewDeposit = typeof deposits.$inferInsert;
export type Decommit = typeof decommits.$inferSelect;
export type NewDecommit = typeof decommits.$inferInsert;
export type Payment = typeof payments.$inferSelect;
export type NewPayment = typeof payments.$inferInsert;
export type HydraMetric = typeof hydraMetrics.$inferSelect;
export type NewHydraMetric = typeof hydraMetrics.$inferInsert;
