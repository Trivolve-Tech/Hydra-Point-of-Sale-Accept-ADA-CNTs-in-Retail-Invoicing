# Architecture

The stack is four boxes on one network. Three of them are off-the-shelf; only `merchant-pos` and `invoice-backend` carry project-specific code.

```text
                    ┌──────────────────┐
                    │  Customer wallet │
                    │   (CIP-30)       │
                    └────────┬─────────┘
                             │ in-head tx (L2)
                             ▼
┌──────────────────┐   ┌──────────────────┐   ┌──────────────────┐
│   merchant-pos   │──▶│    hydra-node    │──▶│   cardano-node   │
│  (Next.js + UI)  │   │ (Hydra Head L2)  │   │   (L1 ledger)    │
└────────┬─────────┘   └────────▲─────────┘   └──────────────────┘
         │                      │
         │ REST proxy           │ commit / fanout
         ▼                      │
┌──────────────────┐            │
│ invoice-backend  │            │ L1 fallback if head
│ (Express + JSON) │            │ unavailable
└──────────────────┘            ▼
                          Cardano mainnet / testnet
```

## Components

### `merchant-pos` (Next.js)

- Storefront / checkout UI built on the T3 stack (Next.js + Tailwind).
- CIP-30 wallet adapter for the customer side (Mesh + custom bridge).
- Server routes under `src/pages/api/`:
    - `api/invoices/**` — proxy to `invoice-backend`
    - `api/hydra/**` — Hydra head status, payment intents, metrics, merchant feedback
    - `api/payment.ts` — final payment finalizer used by both L1 and L2 paths
- Mainnet vs testnet selected at runtime by `CARDANO_NETWORK` env var; the server branch is in `src/server/cardano.ts`.

### `invoice-backend` (Express)

- Invoice CRUD with statuses `draft`, `issued`, `pending_payment`, `paid`, `expired`, `cancelled`, `failed`.
- PDF export per invoice + Excel export of all invoices.
- JSON-file persistence (`invoice-backend/data/invoices.json`); swap in a real database without changing the HTTP contract.

### `hydra-node` (IOG / Cardano-Scaling reference)

- Runs the Hydra Head protocol; exposes its WebSocket API on `:4001`.
- Keys live in `docker/hydra-node/keys/` (mounted read-only).
- See [Deployment → Testnet](deployment-testnet.md) for key generation.

### `cardano-node` (Intersect MBO reference image)

- Tracks the chosen Cardano network (preprod / preview / mainnet).
- Selected by the `NETWORK` env var in each Docker compose file.

## Data flow: a Hydra L2 payment

1. **Checkout**: merchant-pos calls `invoice-backend POST /invoices` to create an invoice; the response carries the invoice id.
2. **Payment intent**: merchant-pos `POST /api/hydra/intent` builds a Hydra L2 intent (amount, expected payee), returns a payable identifier for the customer wallet.
3. **Customer signs**: customer wallet builds an in-head transaction against the live Hydra head and submits via the merchant-pos bridge.
4. **L2 settlement**: hydra-node confirms the tx (≈ 380 ms average per pilot data).
5. **Status reflection**: merchant-pos polls `api/hydra/status?intent=…`; when settled, marks the invoice `paid` and emits the merchant-side webhook (if configured).
6. **L1 fallback**: if the head is not open (sync, missing peer, etc.), merchant-pos falls back to a direct L1 tx through Blockfrost; the customer still pays from the same wallet. About 6 of 147 pilot payments fell back automatically with no merchant intervention.

## Where mainnet differs from testnet

- The `cardano-node` env switches from `NETWORK: preprod` to `NETWORK: mainnet`; the hydra-node `--testnet-magic` flag is removed (mainnet has no magic).
- `BLOCKFROST_URL` and `BLOCKFROST_KEY` point at the mainnet project.
- The merchant-pos build refuses to expose any of the preprod-only test routes from the e2e harness.

The two compose files diff cleanly:

```bash
diff docker/docker-compose.preprod.yml docker/docker-compose.mainnet.yml
```
