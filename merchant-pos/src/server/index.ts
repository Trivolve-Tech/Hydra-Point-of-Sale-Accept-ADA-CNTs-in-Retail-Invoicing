"use server"

import { getNewPaymentAddress } from "./cardano";
import { getHydraRouter } from "./hydra/singleton";
import { getMetricsCollector } from "./hydra/metrics";
import type { SettlementLayer } from "./hydra/payment-router";
import { randomUUID } from "crypto";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join } from "path";

export interface PaymentRecord {
  tx_id: string;
  amount: number;
  payment_address: string;
  settlement_layer: SettlementLayer;
  hydra_status?: "pending" | "confirmed" | "failed";
  hydra_tx_id?: string;
  hydra_confirmed_at?: string;
  l1_fallback_reason?: string;
  created_at: string;
}

const DATA_DIR = join(process.cwd(), "data");
const STORE_PATH = join(DATA_DIR, "payment-records.json");

function ensureStore(): PaymentRecord[] {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
  if (!existsSync(STORE_PATH)) {
    writeFileSync(STORE_PATH, "[]", "utf-8");
    return [];
  }
  return JSON.parse(readFileSync(STORE_PATH, "utf-8")) as PaymentRecord[];
}

function saveStore(records: PaymentRecord[]) {
  writeFileSync(STORE_PATH, JSON.stringify(records, null, 2), "utf-8");
}

export const getTransactionRef = async (id: string) => {
  const records = ensureStore();
  return records.find((r) => r.tx_id === id) ?? null;
};

export const updateTransactionRef = async (
  id: string,
  patch: Partial<PaymentRecord>,
) => {
  const records = ensureStore();
  const idx = records.findIndex((r) => r.tx_id === id);
  if (idx === -1) return null;
  records[idx] = { ...records[idx]!, ...patch };
  saveStore(records);
  return records[idx]!;
};

export const createNewTx = async (amount: number, preferHydra = true) => {
  const records = ensureStore();
  const router = getHydraRouter();

  let settlementLayer: SettlementLayer = "L1";
  let l1FallbackReason: string | undefined;

  if (router && preferHydra) {
    try {
      settlementLayer = await router.selectSettlementLayer(true);
      if (settlementLayer === "L1") {
        l1FallbackReason = "Hydra head not available";
      }
    } catch {
      settlementLayer = "L1";
      l1FallbackReason = "Hydra availability check failed";
    }
  } else if (preferHydra && !router) {
    l1FallbackReason = "Hydra not configured";
  }

  const newAddress = getNewPaymentAddress(records.length + 1);
  const tx: PaymentRecord = {
    tx_id: randomUUID(),
    amount,
    payment_address: newAddress,
    settlement_layer: settlementLayer,
    hydra_status: settlementLayer === "L2" ? "pending" : undefined,
    l1_fallback_reason: l1FallbackReason,
    created_at: new Date().toISOString(),
  };

  records.push(tx);
  saveStore(records);

  getMetricsCollector().recordPaymentCreated(tx.tx_id, settlementLayer);
  if (l1FallbackReason && preferHydra) {
    getMetricsCollector().recordL2Fallback(tx.tx_id, l1FallbackReason);
  }

  return tx;
};
