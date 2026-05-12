import type { HydraHttpClient } from "./hydra-http";
import type { HydraStateStore } from "./state-store";
import { InMemoryHydraStateStore } from "./state-store";
import type { HydraInboundMessage } from "./types";
import { seqOf } from "./types";

export enum HydraSyncPolicy {
  none = "none",
  dedupeOnly = "dedupeOnly",
  dedupeAndRefreshOnGap = "dedupeAndRefreshOnGap",
}

export class SeqTracker {
  readonly policy: HydraSyncPolicy;
  private store: HydraStateStore;
  private http: HydraHttpClient | null;
  private onSeqGap: ((lastSeq: number, receivedSeq: number) => void) | null;
  private last: number | null = null;

  constructor(opts: {
    policy: HydraSyncPolicy;
    store?: HydraStateStore;
    http?: HydraHttpClient;
    onSeqGap?: (lastSeq: number, receivedSeq: number) => void;
  }) {
    this.policy = opts.policy;
    this.store = opts.store ?? new InMemoryHydraStateStore();
    this.http = opts.http ?? null;
    this.onSeqGap = opts.onSeqGap ?? null;
  }

  get lastSeq(): number | null {
    return this.last;
  }

  async restore(): Promise<void> {
    this.last = await this.store.loadLastSeq();
  }

  reset(): void {
    this.last = null;
  }

  async process(message: HydraInboundMessage): Promise<HydraInboundMessage | null> {
    const seq = seqOf(message);
    if (seq === null) return message;

    switch (this.policy) {
      case HydraSyncPolicy.none:
        this.last = seq;
        await this.store.saveLastSeq(seq);
        return message;

      case HydraSyncPolicy.dedupeOnly:
      case HydraSyncPolicy.dedupeAndRefreshOnGap:
        if (this.last !== null && seq <= this.last) {
          return null;
        }
        if (
          this.policy === HydraSyncPolicy.dedupeAndRefreshOnGap &&
          this.last !== null &&
          seq > this.last + 1
        ) {
          this.onSeqGap?.(this.last, seq);
          this.refreshSnapshotHint();
        }
        this.last = seq;
        await this.store.saveLastSeq(seq);
        return message;
    }
  }

  private refreshSnapshotHint() {
    if (!this.http) return;
    const h = this.http;
    void (async () => {
      try {
        const r = await h.getSnapshotLastSeen();
        await this.store.saveSnapshotHint(JSON.stringify(r.data));
      } catch {
        // best-effort
      }
    })();
  }
}
