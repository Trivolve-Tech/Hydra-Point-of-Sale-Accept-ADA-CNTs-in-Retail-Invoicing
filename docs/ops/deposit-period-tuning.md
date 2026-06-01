# Tuning `--deposit-period`

This single hydra-node flag governs both ends of the L1-deposit lifecycle.
Default in this repo is **300 s (5 min)** for mainnet; this document
explains why and when to change it.

## What the flag controls

```
   ──────── L1 commit-tx upper validity = 2 × deposit-period ────────
   │                                                                  │
   ▼                                                                  ▼
[ DepositRecorded ]──deposit-period──>[ DepositActivated ]──deposit-period──>[ Expired ]
   │                                     │                                      │
   L1 commit observed              snapshot leader may              the commit tx's TTL
   by hydra-node                   propose to include it            elapses; deposit is
                                                                    recoverable by
                                                                    DELETE /commits/<txId>
```

The first half (Recorded → Activated) is a **chain-settlement buffer**:
Hydra refuses to incorporate the deposit into L2 until the L1 commit
transaction has been on chain for `deposit-period` seconds. That guards
against an L1 rollback double-spending money the in-head ledger has
already counted as credited.

The second half (Activated → Expired) is the **window in which the snapshot
leader must actually include it**. Miss this window and the deposit
auto-expires; the L1 funds stay locked in the Hydra commit script until
someone submits a recovery transaction.

## Why 300 s on mainnet

Cardano mainnet produces a block roughly every 20 seconds.
`deposit-period = 300 s ≈ 15 blocks` of L1 finality before Hydra trusts
the deposit. That's the Hydra-team-recommended default for real-money
deployments.

| `--deposit-period` | Settlement buffer | Inclusion window | Total commit-tx TTL | Notes |
|---|---|---|---|---|
| **60 s** | ~3 blocks | ~60 s | 120 s | Inclusion window is too small in practice — block-tick jitter + the two-party `ReqSn` / `AckSn` round-trip easily eats it. We measured this failing on mainnet. |
| **120 s** | ~6 blocks | 120 s | 240 s | Borderline on mainnet; OK for low-jitter local preprod. |
| **300 s** | ~15 blocks | 300 s | 600 s | **Recommended default.** Survives normal block jitter and two-party network round-trips. |
| **600 s** | ~30 blocks | 600 s | 1200 s | Maximally safe; total commit time approaches 12 minutes which hurts UX. |

## Setting the value

Per-head, in [`docker/compose.head.tmpl.yml`](../../docker/compose.head.tmpl.yml):

```yaml
command:
  - hydra-node
  - --contestation-period
  - "43200s"
  - --deposit-period
  - "300s"    # <-- here, for both merchant-node and customer-node
```

The orchestrator
([`merchant-pos/src/server/orchestrator/compose.ts`](../../merchant-pos/src/server/orchestrator/compose.ts))
instantiates this template into `docker/heads/<head-id>.yml` for each new
head. After editing the template, all **future** heads use the new value.
Existing heads must be force-recreated:

```bash
docker compose --env-file docker/.env.mainnet \
  -f docker/heads/<head-id>.yml up -d --force-recreate
```

`docker compose restart` is NOT enough — it preserves the original command
line; only `up -d --force-recreate` re-reads the YAML.

## Recovering an expired deposit

If a deposit hits `Expired` before incorporation:

```bash
# Find the commit tx id from the hydra-node logs (DepositExpired event)
TXID=<commit-tx-id>

# Ask hydra-node to draft + sign + submit the recovery tx
curl -X DELETE http://<hydra-host>:<merchant-api-port>/commits/$TXID
# → "OK"
```

Within ~30 seconds the L1 UTxO returns to the deposit address. The customer
can then retry the commit from the customer page.

## Telemetry to watch

In hydra-node logs (`docker logs hydra-pos-head-<id>-merchant-node-1`):

- `OnDepositTx` → hydra-node has seen the L1 commit
- `DepositRecorded` → stored as pending
- `DepositActivated` → ready to incorporate (this is what's slow on small
  `--deposit-period`)
- `ReqSn` / `AckSn` → snapshot leader proposing inclusion
- `SnapshotConfirmed` → done; the deposit is now in the L2 ledger

In the merchant-pos process logs:

- `[/api/heads/<id>/commit-deposit]` → submission of the commit tx to L1
- `[/api/intents/<tx>/pay]` → in-head transfer to a merchant
