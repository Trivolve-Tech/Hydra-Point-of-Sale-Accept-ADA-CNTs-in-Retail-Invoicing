/**
 * L1↔L2 reconciliation for all open Hydra heads.
 *
 * Usage:
 *   pnpm reconcile            # all heads
 *   pnpm reconcile <head_id>  # one head
 *
 * For each head: expected balance = Σ finalised deposits − Σ finalised decommits.
 * Observed balance = sum of lovelace in /snapshot/utxo. Reports drift in lovelace.
 *
 * Cron: run hourly during the pilot; alert on any non-zero diff.
 */
import { sum, eq } from "drizzle-orm";

import { getDb } from "../pos/src/server/db/client";
import { deposits, decommits, heads } from "../pos/src/server/db/schema";
import { getHeadById } from "../pos/src/server/heads";
import { makeHydraHttpClient } from "../pos/src/server/hydra/registry";

type Drift = {
  headId: string;
  state: string;
  expectedLovelace: bigint;
  observedLovelace: bigint;
  diffLovelace: bigint;
};

async function reconcileOne(headId: string): Promise<Drift | null> {
  const head = await getHeadById(headId);
  if (!head) return null;

  const db = getDb();
  const dep = await db
    .select({ total: sum(deposits.amountLovelace) })
    .from(deposits)
    .where(eq(deposits.headId, headId));
  const dec = await db
    .select({ total: sum(decommits.amountLovelace) })
    .from(decommits)
    .where(eq(decommits.headId, headId));

  const depositTotal = BigInt(dep[0]?.total ?? 0);
  const decommitTotal = BigInt(dec[0]?.total ?? 0);
  const expected = depositTotal - decommitTotal;

  const client = await makeHydraHttpClient(headId);
  let observed = 0n;
  if (client) {
    try {
      const resp = await client.getSnapshotUtxo();
      const all = (resp.data ?? {}) as Record<string, { value?: Record<string, number> }>;
      for (const entry of Object.values(all)) {
        const lovelace = entry?.value?.lovelace;
        if (typeof lovelace === "number") observed += BigInt(lovelace);
      }
    } catch {
      // Leave observed = 0; the diff column will reveal the gap.
    }
  }

  return {
    headId,
    state: head.state,
    expectedLovelace: expected,
    observedLovelace: observed,
    diffLovelace: observed - expected,
  };
}

async function main() {
  const arg = process.argv[2];
  let headIds: string[];
  if (arg) {
    headIds = [arg];
  } else {
    const all = await getDb().select({ id: heads.id }).from(heads);
    headIds = all.map((r) => r.id);
  }

  const results: Drift[] = [];
  for (const id of headIds) {
    const r = await reconcileOne(id);
    if (r) results.push(r);
  }

  const driftRows = results.filter((r) => r.diffLovelace !== 0n);
  console.log(`reconcile: ${results.length} heads, ${driftRows.length} with drift`);
  console.table(
    results.map((r) => ({
      head: r.headId.slice(0, 8) + "…",
      state: r.state,
      expected_ADA: lovelaceToAda(r.expectedLovelace),
      observed_ADA: lovelaceToAda(r.observedLovelace),
      drift_ADA: lovelaceToAda(r.diffLovelace),
    })),
  );

  process.exitCode = driftRows.length === 0 ? 0 : 2;
}

function lovelaceToAda(l: bigint): string {
  const sign = l < 0n ? "-" : "";
  const abs = l < 0n ? -l : l;
  const whole = abs / 1_000_000n;
  const frac = (abs % 1_000_000n).toString().padStart(6, "0").replace(/0+$/, "");
  return `${sign}${whole}${frac ? "." + frac : ""}`;
}

void main().catch((err) => {
  console.error("reconcile failed:", err);
  process.exitCode = 1;
});
