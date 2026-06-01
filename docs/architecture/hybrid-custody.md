# Hybrid custody architecture

This is the most important document in the repo. Read it before sending real
ADA through the system.

## The model in one diagram

```
   ┌──────────────────────┐       L1                ┌──────────────────────┐
   │ Customer wallet      │   wallet -> deposit     │ Per-customer deposit │
   │ (Vespr / Eternl / …) │ ─────signed by user───> │ address (server-key) │
   └──────────────────────┘                         └──────────────────────┘
                                                              │
                                                  hydra /commit (server signs)
                                                              ▼
                                                    ┌──────────────────────┐
                                                    │ Hydra commit script  │
                                                    │ (L1 commit script)   │
                                                    └──────────────────────┘
                                                              │
                                       DepositRecorded → Activated → Snapshot
                                                              ▼
   ┌──────────────────────┐       L2                ┌──────────────────────┐
   │ Merchant in-head     │ <───server-signed──── │ Deposit-addr in-head │
   │ enterprise address   │   in-head transfer    │ UTxO (server-key)    │
   └──────────────────────┘                         └──────────────────────┘
```

| Action | Who signs | Why |
|---|---|---|
| L1 send wallet → deposit address | **Customer's wallet** (CIP-30) | Normal Cardano transfer — input UTxO lives on L1, the wallet can see it and produce a valid witness. |
| L1 Hydra `/commit` from deposit address | **Server** (per-customer ed25519 key) | The input UTxO is at a server-controlled address, so the server holds the only key authorised to spend it. |
| L2 in-head spend (paying a merchant intent) | **Server** (same per-customer key) | The in-head UTxO is invisible to CIP-30 wallets by design — no wallet can produce a witness for it. |
| L1 fan-out on head close | hydra-node returns funds to the deposit address; the server can sweep back to the customer's wallet | Customer funds remain cryptographically theirs at every step (always recoverable in the worst case). |

## Why the customer's wallet can't sign L2 transactions

CIP-30 wallets decide which inputs need their signature by checking each
input UTxO against the user's own UTxO set on L1. When the input lives
inside a Hydra head's L2 snapshot, the wallet has no record of it and
returns an **empty witness set** — even with `partialSign = true`. The
hydra-node then rejects the submission with
`MissingVKeyWitnessesUTXOW`.

We verified this directly with Vespr (returns 0 witnesses, silently),
which is the cause of every previous "fully non-custodial" Hydra demo
project being limited to merchant-signed flows.

The hybrid model is the simplest design that:

- keeps the customer's L1 wallet fully self-custodial (every coin that
  leaves their wallet is signed by them),
- moves L2 spend authority to a key the server actually controls and can
  use to sign in-head transactions,
- bounds the custody risk to "the head is open" — on fan-out, hydra
  redeems the L2 UTxO back to L1 at the deposit address, after which the
  server can return funds to the original wallet.

## Per-customer L2 spend keys

Each customer profile owns a freshly generated `csl.PrivateKey.generate_ed25519()`.
The private key is **AES-256-GCM encrypted** at rest in the `customers.metadata`
JSON column, with the key derived from `HPOS_KEY_SECRET` (a 32-byte
server-side secret rotatable on demand). The matching public key derives
the customer's mainnet **enterprise address** — that's the "deposit
address" displayed on the customer page.

Implementation:

| File | What it does |
|---|---|
| [`merchant-pos/src/server/customer-profile.ts`](../../merchant-pos/src/server/customer-profile.ts) | Generates the L2 key at profile creation, encrypts it, derives the deposit address. Lazy-migrates older non-custodial profiles. Provides `getProfileSpendKey(id)` to the API endpoints. |
| [`merchant-pos/src/server/in-head-tx.ts`](../../merchant-pos/src/server/in-head-tx.ts) | Builds the in-head L2 transaction using cardano-serialization-lib and signs it with the customer's spend key via `FixedTransaction.sign_and_add_vkey_signature`. |
| [`merchant-pos/src/server/l1-submit.ts`](../../merchant-pos/src/server/l1-submit.ts) | Submits Cardano L1 transactions through Blockfrost, used both by the commit-deposit endpoint and by recovery flows. |
| [`merchant-pos/src/pages/api/heads/[id]/commit-deposit.ts`](../../merchant-pos/src/pages/api/heads/%5Bid%5D/commit-deposit.ts) | Picks the UTxO at the deposit address, asks hydra-node `/commit` for a draft tx, signs it with the L2 spend key, submits to L1. |
| [`merchant-pos/src/pages/api/intents/[tx]/pay.ts`](../../merchant-pos/src/pages/api/intents/%5Btx%5D/pay.ts) | Builds + signs the in-head transfer and submits to hydra-node `/transaction`. Accepts the v1.3 `202 SubmitTxSubmitted` response as success (200 was assumed by earlier code and is left in place for forward compat). |

## End-to-end commit flow

```
Click "Commit X ADA"                            t = 0s
   │
   ├── Vespr signs L1 send wallet → deposit-addr  ~15s
   ├── L1 send lands at deposit address           ~30s
   ├── Server signs + submits Hydra /commit       ~5s
   ├── Commit tx confirms on L1                   ~30s
   ├── DepositRecorded by hydra-node              <5s
   ├── DepositActivated (waits --deposit-period)  ~5 min
   └── Snapshot leader incorporates → L2 UTxO     ~30s
                                                  ──────
                                                  ~6.5 min total
```

The customer page renders this as a six-step vertical stepper with live
elapsed time and an ETA at the top
([`merchant-pos/src/pages/customer/index.tsx`](../../merchant-pos/src/pages/customer/index.tsx),
`CommitStepper`).

## Pay flow

```
Merchant pushes intent
   │
   └── Customer taps Pay  ─────►  POST /api/intents/<tx>/pay
                                      │
                                      ├── server reads intent + customer profile
                                      ├── server fetches in-head UTxO at deposit-addr
                                      ├── server builds in-head tx (CSL)
                                      ├── server signs with profile's L2 key
                                      └── POST hydra-node /transaction
                                              ▼
                                          202 SubmitTxSubmitted
                                              ▼
                                          intent.status = paid
```

No wallet signature is needed at pay time; the merchant dashboard flips to
"Confirmed" within ~1 second of the customer tapping Pay.

## Failure modes worth knowing

| Symptom | Cause | Fix |
|---|---|---|
| Pay returns `MissingVKeyWitnessesUTXOW` | Old code path that asked Vespr to sign the L2 tx. Should never happen after the rewrite. | Check you're on the current `pay.ts` (`POST` body is `{profile_id}` only — no `signed_cbor`). |
| Commit succeeded on L1 but in-head balance never updates, and you see `DepositExpired` in hydra-node logs | `--deposit-period` is too short; the snapshot leader didn't get to incorporate the deposit before it expired. | Recover with `curl -X DELETE http://<hydra>:4001/commits/<txId>`, then bump `--deposit-period` (see [docs/ops/deposit-period-tuning.md](../ops/deposit-period-tuning.md)). |
| User funds stranded in-head after some operational hiccup | The customer's wallet address (not the deposit address) holds in-head UTxOs from a pre-hybrid profile. | Fan-out via head close; the UTxO returns to the customer's L1 wallet address. |
| `Blockfrost /tx/submit 400 — TxValidationErrorInCardanoMode` on commit | The commit tx's upper-validity bound (TTL) expired between drafting and submission. Usually because the merchant fee-funding address ran out and the commit was redrafted with stale chainTime. | Top up the operator fee-funding address; rebuild. |

## Why "L1 non-custodial, L2 server-signed" is the safest practical model

A pure non-custodial design would require the wallet to sign for the in-head
UTxO, which CIP-30 cannot do today. A pure custodial design would require the
server to hold the customer's L1 spend key — much higher blast radius.

The hybrid model puts the server in the role of a **per-customer signing oracle**
whose authority is scoped to one head's in-head transactions, time-bounded by
the head's lifetime. If `HPOS_KEY_SECRET` leaks, an attacker can spend in-head
balances of any open profile — but they cannot move L1 funds outside the head
and they cannot create or close heads. On head close, all in-head funds
fan-out to addresses the operator controls; the operator returns them to the
original wallets via a signed sweep.
