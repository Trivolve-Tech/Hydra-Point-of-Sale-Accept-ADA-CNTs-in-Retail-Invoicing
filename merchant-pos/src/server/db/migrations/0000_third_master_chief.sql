CREATE TYPE "public"."customer_status" AS ENUM('pending', 'active', 'suspended', 'offboarded');--> statement-breakpoint
CREATE TYPE "public"."decommit_status" AS ENUM('submitted', 'approved', 'finalized', 'failed');--> statement-breakpoint
CREATE TYPE "public"."deposit_status" AS ENUM('drafted', 'submitted', 'observed', 'incremented', 'finalized', 'recovered', 'failed');--> statement-breakpoint
CREATE TYPE "public"."head_state" AS ENUM('initializing', 'open', 'closed', 'fanout_complete', 'failed');--> statement-breakpoint
CREATE TYPE "public"."invoice_status" AS ENUM('draft', 'issued', 'pending_payment', 'paid', 'expired', 'cancelled', 'failed');--> statement-breakpoint
CREATE TYPE "public"."party_role" AS ENUM('merchant', 'customer');--> statement-breakpoint
CREATE TYPE "public"."payment_status" AS ENUM('pending', 'submitted', 'confirmed', 'failed');--> statement-breakpoint
CREATE TYPE "public"."settlement_layer" AS ENUM('L1', 'L2');--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "customers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"label" varchar(200),
	"hydra_vk" text NOT NULL,
	"cardano_vk" text NOT NULL,
	"status" "customer_status" DEFAULT 'pending' NOT NULL,
	"enrolled_at" timestamp with time zone DEFAULT now() NOT NULL,
	"metadata" jsonb
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "decommits" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"head_id" uuid NOT NULL,
	"tx_hash_l1" text,
	"amount_lovelace" bigint NOT NULL,
	"status" "decommit_status" DEFAULT 'submitted' NOT NULL,
	"requested_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finalized_at" timestamp with time zone,
	"error" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "deposits" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"head_id" uuid NOT NULL,
	"tx_hash_l1" text,
	"amount_lovelace" bigint NOT NULL,
	"status" "deposit_status" DEFAULT 'drafted' NOT NULL,
	"requested_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finalized_at" timestamp with time zone,
	"error" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "head_keys" (
	"head_id" uuid NOT NULL,
	"role" "party_role" NOT NULL,
	"hydra_vk" text NOT NULL,
	"cardano_vk" text NOT NULL,
	"hydra_sk_path" text,
	"cardano_sk_path" text,
	CONSTRAINT "head_keys_head_id_role_pk" PRIMARY KEY("head_id","role")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "heads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"customer_id" uuid NOT NULL,
	"head_id_chain" text,
	"state" "head_state" DEFAULT 'initializing' NOT NULL,
	"merchant_api_port" integer NOT NULL,
	"merchant_peer_port" integer NOT NULL,
	"customer_api_port" integer NOT NULL,
	"customer_peer_port" integer NOT NULL,
	"contestation_period_seconds" integer NOT NULL,
	"opened_at" timestamp with time zone,
	"closed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "hydra_metrics" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"head_id" uuid,
	"kind" varchar(80) NOT NULL,
	"latency_ms" integer,
	"error" text,
	"details" jsonb,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "invoices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"number" varchar(60) NOT NULL,
	"reference" varchar(200),
	"customer_id" uuid,
	"status" "invoice_status" DEFAULT 'issued' NOT NULL,
	"asset_unit" text NOT NULL,
	"asset_quantity" text NOT NULL,
	"line_items" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"customer_name" varchar(200),
	"customer_email" varchar(320),
	"customer_phone" varchar(40),
	"notes" text,
	"metadata" jsonb,
	"expiry_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"paid_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"head_id" uuid,
	"invoice_id" uuid,
	"amount_lovelace" bigint NOT NULL,
	"settlement_layer" "settlement_layer" NOT NULL,
	"status" "payment_status" DEFAULT 'pending' NOT NULL,
	"in_head_tx_id" text,
	"l1_fallback_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"confirmed_at" timestamp with time zone
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "decommits" ADD CONSTRAINT "decommits_head_id_heads_id_fk" FOREIGN KEY ("head_id") REFERENCES "public"."heads"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "deposits" ADD CONSTRAINT "deposits_head_id_heads_id_fk" FOREIGN KEY ("head_id") REFERENCES "public"."heads"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "head_keys" ADD CONSTRAINT "head_keys_head_id_heads_id_fk" FOREIGN KEY ("head_id") REFERENCES "public"."heads"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "heads" ADD CONSTRAINT "heads_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "hydra_metrics" ADD CONSTRAINT "hydra_metrics_head_id_heads_id_fk" FOREIGN KEY ("head_id") REFERENCES "public"."heads"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "invoices" ADD CONSTRAINT "invoices_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "payments" ADD CONSTRAINT "payments_head_id_heads_id_fk" FOREIGN KEY ("head_id") REFERENCES "public"."heads"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "payments" ADD CONSTRAINT "payments_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "customers_hydra_vk_idx" ON "customers" USING btree ("hydra_vk");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "decommits_head_idx" ON "decommits" USING btree ("head_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "deposits_head_idx" ON "deposits" USING btree ("head_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "heads_customer_idx" ON "heads" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "heads_state_idx" ON "heads" USING btree ("state");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "hydra_metrics_occurred_at_idx" ON "hydra_metrics" USING btree ("occurred_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "hydra_metrics_head_idx" ON "hydra_metrics" USING btree ("head_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "invoices_number_idx" ON "invoices" USING btree ("number");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "invoices_customer_idx" ON "invoices" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "invoices_status_idx" ON "invoices" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "payments_head_idx" ON "payments" USING btree ("head_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "payments_invoice_idx" ON "payments" USING btree ("invoice_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "payments_status_idx" ON "payments" USING btree ("status");