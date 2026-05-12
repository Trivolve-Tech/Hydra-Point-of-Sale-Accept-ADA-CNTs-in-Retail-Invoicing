import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join, dirname } from "path";

export interface MetricEvent {
  type: "payment_created" | "payment_confirmed" | "l2_fallback" | "hydra_connection";
  tx_id?: string;
  settlement_layer?: "L1" | "L2";
  confirmation_time_ms?: number;
  reason?: string;
  state?: string;
  timestamp: string;
}

export interface MetricsSummary {
  total_payments: number;
  total_l1: number;
  total_l2: number;
  l2_confirmed: number;
  l1_confirmed: number;
  avg_l2_confirmation_ms: number | null;
  avg_l1_confirmation_ms: number | null;
  fallback_count: number;
  fallback_reasons: Record<string, number>;
  connection_events: number;
  first_event_at: string | null;
  last_event_at: string | null;
}

const METRICS_PATH = join(process.cwd(), "data", "hydra-metrics.json");

export class HydraMetricsCollector {
  private events: MetricEvent[] = [];
  private loaded = false;

  private load() {
    if (this.loaded) return;
    this.loaded = true;
    try {
      if (existsSync(METRICS_PATH)) {
        this.events = JSON.parse(readFileSync(METRICS_PATH, "utf-8")) as MetricEvent[];
      }
    } catch {
      this.events = [];
    }
  }

  private save() {
    const dir = dirname(METRICS_PATH);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    writeFileSync(METRICS_PATH, JSON.stringify(this.events, null, 2), "utf-8");
  }

  record(event: Omit<MetricEvent, "timestamp">) {
    this.load();
    this.events.push({ ...event, timestamp: new Date().toISOString() });
    this.save();
  }

  recordPaymentCreated(txId: string, layer: "L1" | "L2") {
    this.record({ type: "payment_created", tx_id: txId, settlement_layer: layer });
  }

  recordPaymentConfirmed(txId: string, layer: "L1" | "L2", confirmationTimeMs: number) {
    this.record({
      type: "payment_confirmed",
      tx_id: txId,
      settlement_layer: layer,
      confirmation_time_ms: confirmationTimeMs,
    });
  }

  recordL2Fallback(txId: string, reason: string) {
    this.record({ type: "l2_fallback", tx_id: txId, reason });
  }

  recordConnection(state: string) {
    this.record({ type: "hydra_connection", state });
  }

  getSummary(): MetricsSummary {
    this.load();
    const created = this.events.filter((e) => e.type === "payment_created");
    const confirmed = this.events.filter((e) => e.type === "payment_confirmed");
    const fallbacks = this.events.filter((e) => e.type === "l2_fallback");
    const connections = this.events.filter((e) => e.type === "hydra_connection");

    const l2Confirmed = confirmed.filter((e) => e.settlement_layer === "L2");
    const l1Confirmed = confirmed.filter((e) => e.settlement_layer === "L1");

    const avgMs = (items: MetricEvent[]) => {
      const times = items.map((e) => e.confirmation_time_ms).filter((t): t is number => t != null);
      if (times.length === 0) return null;
      return Math.round(times.reduce((a, b) => a + b, 0) / times.length);
    };

    const fallbackReasons: Record<string, number> = {};
    for (const f of fallbacks) {
      const r = f.reason ?? "unknown";
      fallbackReasons[r] = (fallbackReasons[r] ?? 0) + 1;
    }

    const timestamps = this.events.map((e) => e.timestamp).sort();

    return {
      total_payments: created.length,
      total_l1: created.filter((e) => e.settlement_layer === "L1").length,
      total_l2: created.filter((e) => e.settlement_layer === "L2").length,
      l2_confirmed: l2Confirmed.length,
      l1_confirmed: l1Confirmed.length,
      avg_l2_confirmation_ms: avgMs(l2Confirmed),
      avg_l1_confirmation_ms: avgMs(l1Confirmed),
      fallback_count: fallbacks.length,
      fallback_reasons: fallbackReasons,
      connection_events: connections.length,
      first_event_at: timestamps[0] ?? null,
      last_event_at: timestamps[timestamps.length - 1] ?? null,
    };
  }

  getEvents(): MetricEvent[] {
    this.load();
    return [...this.events];
  }
}

let instance: HydraMetricsCollector | null = null;

export function getMetricsCollector(): HydraMetricsCollector {
  if (!instance) instance = new HydraMetricsCollector();
  return instance;
}
