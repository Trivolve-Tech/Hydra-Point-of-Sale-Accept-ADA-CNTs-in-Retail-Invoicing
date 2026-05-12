import { SeqTracker, HydraSyncPolicy } from "../seq-tracker";
import { InMemoryHydraStateStore } from "../state-store";
import type { HydraInboundMessage } from "../types";

function txValid(seq: number): HydraInboundMessage {
  return {
    tag: "TxValid",
    seq,
    timestamp: "2025-01-01T00:00:00Z",
    json: { tag: "TxValid", seq },
  };
}

function greetings(): HydraInboundMessage {
  return {
    tag: "Greetings",
    json: { tag: "Greetings", headStatus: "Open" },
  };
}

describe("SeqTracker", () => {
  describe("policy: none", () => {
    it("forwards all messages and persists seq", async () => {
      const store = new InMemoryHydraStateStore();
      const tracker = new SeqTracker({ policy: HydraSyncPolicy.none, store });

      const result = await tracker.process(txValid(1));
      expect(result).not.toBeNull();
      expect(tracker.lastSeq).toBe(1);
      expect(await store.loadLastSeq()).toBe(1);
    });

    it("forwards messages with lower seq (no dedup)", async () => {
      const tracker = new SeqTracker({ policy: HydraSyncPolicy.none });
      await tracker.process(txValid(5));
      const result = await tracker.process(txValid(3));
      expect(result).not.toBeNull();
    });
  });

  describe("policy: dedupeOnly", () => {
    it("drops messages with seq <= lastSeq", async () => {
      const tracker = new SeqTracker({ policy: HydraSyncPolicy.dedupeOnly });
      await tracker.process(txValid(5));
      const dup = await tracker.process(txValid(5));
      expect(dup).toBeNull();
      const old = await tracker.process(txValid(3));
      expect(old).toBeNull();
    });

    it("forwards new messages with higher seq", async () => {
      const tracker = new SeqTracker({ policy: HydraSyncPolicy.dedupeOnly });
      await tracker.process(txValid(1));
      const result = await tracker.process(txValid(2));
      expect(result).not.toBeNull();
    });
  });

  describe("policy: dedupeAndRefreshOnGap", () => {
    it("fires onSeqGap when seq jumps", async () => {
      const gaps: [number, number][] = [];
      const tracker = new SeqTracker({
        policy: HydraSyncPolicy.dedupeAndRefreshOnGap,
        onSeqGap: (last, received) => gaps.push([last, received]),
      });
      await tracker.process(txValid(1));
      await tracker.process(txValid(5));
      expect(gaps).toEqual([[1, 5]]);
    });
  });

  it("passes through non-timed messages regardless of policy", async () => {
    const tracker = new SeqTracker({ policy: HydraSyncPolicy.dedupeOnly });
    await tracker.process(txValid(10));
    const result = await tracker.process(greetings());
    expect(result).not.toBeNull();
    expect(result?.tag).toBe("Greetings");
  });

  it("restores seq from store", async () => {
    const store = new InMemoryHydraStateStore();
    await store.saveLastSeq(42);
    const tracker = new SeqTracker({ policy: HydraSyncPolicy.dedupeOnly, store });
    await tracker.restore();
    expect(tracker.lastSeq).toBe(42);
    const old = await tracker.process(txValid(40));
    expect(old).toBeNull();
  });
});
