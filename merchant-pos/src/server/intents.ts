// In-memory payment-intents store backing the demo merchant+customer flow.
// Pending -> paid (or failed). v1 custodial: server signs L2 spends.

export type Intent = {
  id: string;
  tx_id: string;
  amount_lovelace: string;
  reference?: string;
  customer_name?: string;
  customer_email?: string;
  notes?: string;
  /** Target customer profile id (UUID) — if set, /pay routes via that profile's sk. */
  customer_id?: string;
  settlement_layer: "L2";
  status: "pending" | "paid" | "failed";
  hydra_tx_id?: string;
  created_at: string;
  paid_at?: string;
  failure_reason?: string;
};

const store = new Map<string, Intent>();

function newIntentId(): string {
  const d = new Date();
  const ymd = `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, "0")}${String(d.getUTCDate()).padStart(2, "0")}`;
  const seq = String(store.size + 1).padStart(3, "0");
  return `INT-${ymd}-${seq}`;
}
function newTxId(): string {
  return (globalThis.crypto as Crypto).randomUUID();
}

export function createIntent(params: {
  amount_lovelace: string;
  reference?: string;
  customer_name?: string;
  customer_email?: string;
  notes?: string;
  customer_id?: string;
}): Intent {
  const id = newIntentId();
  const intent: Intent = {
    id,
    tx_id: newTxId(),
    amount_lovelace: params.amount_lovelace,
    reference: params.reference,
    customer_name: params.customer_name,
    customer_email: params.customer_email,
    notes: params.notes,
    customer_id: params.customer_id,
    settlement_layer: "L2",
    status: "pending",
    created_at: new Date().toISOString(),
  };
  store.set(intent.tx_id, intent);
  return intent;
}

export function getIntentByTxId(txId: string): Intent | null {
  return store.get(txId) ?? null;
}

export function listIntents(): Intent[] {
  return Array.from(store.values()).sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export function markPaid(txId: string, hydraTxId: string): Intent | null {
  const i = store.get(txId);
  if (!i) return null;
  i.status = "paid";
  i.hydra_tx_id = hydraTxId;
  i.paid_at = new Date().toISOString();
  store.set(txId, i);
  return i;
}

export function markFailed(txId: string, reason: string): Intent | null {
  const i = store.get(txId);
  if (!i) return null;
  i.status = "failed";
  i.failure_reason = reason;
  store.set(txId, i);
  return i;
}

export function intentStats() {
  let total = 0, l2 = 0, confirmed = 0, confirmedL2Ms = 0, confirmedL2Count = 0;
  for (const i of store.values()) {
    total++;
    if (i.settlement_layer === "L2") l2++;
    if (i.status === "paid") {
      confirmed++;
      if (i.paid_at && i.created_at) {
        const dt = new Date(i.paid_at).getTime() - new Date(i.created_at).getTime();
        if (i.settlement_layer === "L2") {
          confirmedL2Ms += dt;
          confirmedL2Count++;
        }
      }
    }
  }
  return {
    total,
    l2,
    avg_l2_ms: confirmedL2Count ? Math.round(confirmedL2Ms / confirmedL2Count) : null,
    fallbacks: 0,
  };
}
