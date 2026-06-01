# Incident Playbook

Failure modes you will encounter and the recipes for handling them. Read once before mainnet rollout, keep open on-call.

---

## A. Head needs to be closed (planned or unplanned)

When: customer offboarding, key compromise, decommit stalled, customer offline > N days, end of pilot.

1. `POST /api/heads/<id>/close` — sends `SafeClose` to merchant-side hydra-node.
2. Hydra-node posts the close transaction to L1 with the latest mutually-signed snapshot.
3. **12-hour contestation period begins** (mainnet default per Hydra 1.3.0). During this window any party can contest with a more recent snapshot.
4. After contestation, hydra-node posts the fanout transaction. Funds land at each party's Cardano address per the snapshot.
5. After fanout: `pnpm reconcile <head_id>` and confirm zero drift, then `tearDownHead(<id>)` to stop the Compose pair and free the ports.

**Customer offline during close**: not blocking — `SafeClose` works unilaterally. The fanout still pays per the last mutually-signed snapshot, so the customer gets back what they were entitled to as of their last `AckSn`.

---

## B. Operator key compromise (merchant `cardano-sk` or `hydra-sk` exposed)

When: any reason to suspect compromise — disk image leak, employee turnover with key access, suspicious tx on the operator address.

1. **Immediately**: take the pos process offline (`systemctl stop pos`). Block Caddy from forwarding traffic (`caddy stop` or firewall the upstream).
2. Rotate the operator BIP39 seed (`WALLET_SEED_PHRASE`). The old seed is now considered burned.
3. For every **open** head, the operator-side keys generated from the old seed are blast-radius. Close each affected head via the procedure in §A using the OLD running orchestrator before swapping the env. Funds settle to the customer's `cardano-vk` from the snapshot, which is unaffected by the seed rotation.
4. Once all heads are closed and fanout-finalized, swap `WALLET_SEED_PHRASE` and bring pos back up. New enrollments derive from the new seed.

**Why this works**: per-head merchant `cardano-sk`/`hydra-sk` are derived from the operator seed; the customer's recovered funds depend on snapshots that were mutually signed, not on the merchant's signing key surviving the rotation. Closing first is critical — leaving heads open with compromised keys is the unsafe state.

---

## C. Customer key compromise (single head)

When: a pilot customer reports their browser or device was compromised. (In v1 their hydra-sk is on merchant infra; same procedure applies if the merchant's per-head copy is suspected exposed.)

1. `POST /api/heads/<id>/close` for that head immediately.
2. After the 12 h contestation + fanout, the customer's in-head balance settles to their `cardano-vk` on L1. They take possession.
3. Mark the customer row `suspended` in the DB. Future enrollments require a fresh sign-up.

---

## D. Pending deposit stuck (customer signed the draft but tx never appeared on L1)

When: customer reports they signed but their head balance hasn't increased after ~30 minutes.

1. Check Blockfrost or the operator's Cardano explorer for the deposit `tx_hash_l1` (logged in the `deposits` row when the customer submits).
2. If the L1 tx is in the mempool, wait one more block (~20 s mainnet).
3. If the tx never reached L1, the customer's wallet didn't broadcast — ask them to re-submit using the cached CBOR.
4. If the L1 tx confirmed but the hydra-node didn't observe it: check hydra-node logs for `RejectedInputBecauseUnsynced`. The fix: wait for cardano-node to catch up, or restart the head's hydra-node pair (`docker compose -f infra/docker/heads/<id>.yml restart`).
5. As a last resort, `DELETE /commits/<tx_id>` on the hydra-node API to abandon the pending commit; the L1 tx then unblocks the customer's UTxO when the deposit deadline elapses.

---

## E. Hydra-node crash recovery

When: one of the per-head hydra-node containers exits unexpectedly.

1. `docker compose -f infra/docker/heads/<id>.yml logs --tail=200 merchant-node` to inspect.
2. `docker compose -f infra/docker/heads/<id>.yml restart` — hydra-node persists state to `/data` so it should resume.
3. If state is corrupt: backup the affected `hydra-data-<id>-*` volume, then close+fanout the head via §A.

---

## F. Reconciliation drift detected

When: `pnpm reconcile` reports a non-zero diff for any head.

1. Capture the exact numbers reported (head id, expected = commits − decommits, actual = in-head UTxO total).
2. Cross-check via the operator's Cardano explorer: every commit / decommit `tx_hash_l1` for that head should land on L1 in the expected amount.
3. Cross-check via `GET /api/heads/<id>/state` and the hydra-node's `/snapshot/utxo` directly — sum the lovelace.
4. If the drift is in-flight (a recent commit not yet finalised, a decommit awaiting fanout) it will clear; rerun reconcile in 30 minutes.
5. If the drift persists, **pause new enrollments** and close affected heads (§A). Real lost money is the indicator; everything else is timing.

---

## G. Full mainnet pause

When: any incident in B/F/anywhere that suggests systemic compromise.

1. Take Caddy down (`docker stop caddy`).
2. Stop new enrollments by removing `POST /api/customers/enroll` from the routable surface (rename the file or add a 503 short-circuit).
3. Close all open heads in parallel via §A.
4. Communicate with all enrolled customers in writing.

Resume only after the root cause is fixed and a full reconcile is clean.
