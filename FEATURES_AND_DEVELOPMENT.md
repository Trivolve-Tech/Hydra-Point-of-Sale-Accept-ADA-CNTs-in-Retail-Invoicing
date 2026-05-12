## Hydra PoS + Invoicing: Feature & Development Documentation

This repository contains two reference PDFs plus working code components that implement an **invoice generation + tracking** backend and a **merchant UI** with API proxy routes.

### What’s in this repo

- **Requirements**: `Hydra_Point-of-Sale_(PoS)__Invoicing_-_Requirements_Specification_Document.pdf`
- **Architecture**: `Hydra_Point-of-Sale_(PoS)__Invoicing_Technical_architecture_and_design.pdf`
- **Frontend (baseline + integration)**: `merchant-pos/` (Next.js)
- **Backend (invoicing)**: `invoice-backend/` (Node/Express)
- **Milestone demo videos (versioned PoA)**: `docs/demo-videos/` — see [`docs/demo-videos/README.md`](./docs/demo-videos/README.md)

---

## Demo videos (milestone evidence)

Curated **MP4** exports for reviewers live under **`docs/demo-videos/`** (tracked in git). Local scratch exports may still live under `/demo videos/` at repo root; that folder remains gitignored.

- **`01-merchant-full-checkout.mp4`** — merchant-side PoS + invoicing demo.
- **`02-customer.mp4`** — customer wallet pay flow.

Index and link patterns: [`docs/demo-videos/README.md`](./docs/demo-videos/README.md).

---

## Implemented features (code)

### Invoicing (backend)

Implemented in `invoice-backend/`:

- **Invoice CRUD**:
  - `POST /invoices`
  - `GET /invoices`
  - `GET /invoices/:id`
  - `PATCH /invoices/:id`
  - `DELETE /invoices/:id`
- **Invoice statuses**:
  - `draft`, `issued`, `pending_payment`, `paid`, `expired`, `cancelled`, `failed`
- **Exports**:
  - **PDF per invoice**: `GET /invoices/:id/pdf`
  - **Excel (all invoices)**: `GET /exports/invoices.xlsx`
- **Persistence**:
  - JSON file store at `invoice-backend/data/invoices.json` (directory configurable)

### merchant-pos integration (proxy API routes)

Implemented in `merchant-pos/src/pages/api/**`:

- `GET/POST /api/invoices` → proxies to `invoice-backend /invoices`
- `GET/PATCH/DELETE /api/invoices/:id` → proxies to `invoice-backend /invoices/:id`
- `GET /api/invoices/:id/pdf` → proxies to `invoice-backend /invoices/:id/pdf`
- `GET /api/exports/invoices.xlsx` → proxies to `invoice-backend /exports/invoices.xlsx`

### CIP-30 wallet connect + in-browser payment (Mesh)

The merchant UI uses [**Mesh**](https://meshjs.dev/) (`@meshsdk/core`, `@meshsdk/react`) for **CIP-30** browser wallets (Nami, Eternl, Lace, Flint, etc.):

- **`MeshProvider`** wraps the app in `merchant-pos/src/pages/_app.tsx`, with `@meshsdk/react/styles.css` for the wallet control styling.
- **`CardanoWallet`** (connect / disconnect / extension picker) is exposed through `merchant-pos/src/components/mesh/MeshWalletConnect.tsx`. It is loaded **client-only** via `next/dynamic` in `dynamic-mesh.tsx` so SSR does not touch `window.cardano`.
- **Where the connect control appears**: main shell **layout** (`layout/index.tsx`) for the payment gateway (`/`); **inline** again on the **payment** modal (`payment-modal.tsx`) next to “Pay with wallet” so checkout stays self-contained.
- **Payment initiation from the wallet**: `PayWithWalletButton` (`mesh/PayWithWalletButton.tsx`) builds a Mesh **`Transaction`** with a **`BlockfrostProvider`** (same network as the app), sends **lovelace** to the receive address for the active payment intent, then **signs** and **submits** through the connected wallet (shown on the payment modal while the deposit is still pending).

Browser env (optional for connect-only; **required for “Pay with wallet”**):

| Variable | Purpose |
|----------|---------|
| `NEXT_PUBLIC_BLOCKFROST_PROJECT_ID` | Blockfrost project id for UTxO fetch + tx submit in the browser (use a dedicated key; rate-limit appropriately). |
| `NEXT_PUBLIC_CARDANO_NETWORK` | `preprod` (default if unset), `preview`, or `mainnet` — must match the wallet’s network and the Blockfrost project. |

Server-side chain checks (e.g. `invoice-backend`, `CARDANO_NETWORK`, `BLOCKFROST_KEY`) stay separate; only the **public** Blockfrost id is exposed to the client for Mesh.

---

## Data model (invoice)

### Asset representation (ADA/CNT)

Amounts are stored as **base-unit integers** (string) to avoid floating point issues.

- **ADA**:
  - `unit`: `lovelace`
  - `quantity`: integer string (e.g. `"1500000"` for 1.5 ADA)
- **CNT** (generic representation):
  - `unit`: `<policyId>.<assetNameHex>`
  - `quantity`: integer string

### Invoice fields (current)

- `id`: generated (`inv_...`)
- `number`: generated (`INV-YYYYMMDD-...`) unless provided
- `status`
- `asset`: `{ unit, quantity }`
- `expiry_at` (optional)
- `reference` (optional)
- `customer` (optional): `{ name?, email?, phone? }`
- `notes` (optional)
- `metadata` (optional)
- `created_at`, `updated_at`
- `history`: list of lifecycle events (created/updated/status_updated)

---

## Local development

### 1) Run `invoice-backend`

From the repo root:

```bash
cd invoice-backend
npm install
node ./src/index.js
```

Defaults:
- Listens on `http://localhost:7071`
- Persists to `invoice-backend/data/invoices.json`

#### Environment variables (invoice-backend)

- `PORT` (default `7071`)
- `DATA_DIR` (default `./data`)

### 2) Run `merchant-pos`

`merchant-pos` is a separate Next.js app. It can call invoice APIs through its own proxy routes.

Set in `merchant-pos/.env` (see `.env.example`):
- `INVOICE_BACKEND_URL=http://localhost:7071`
- `WALLET_SEED_PHRASE`, `BLOCKFROST_KEY`, `BLOCKFROST_URL`, `CARDANO_NETWORK` (server-side payment addresses + on-chain checks)
- Optional (Mesh in-browser pay): `NEXT_PUBLIC_BLOCKFROST_PROJECT_ID`, `NEXT_PUBLIC_CARDANO_NETWORK` (`preprod` | `preview` | `mainnet`)

**One command — UI + invoice backend** (from `merchant-pos/` after `pnpm install` and `npm install` in `invoice-backend/`):

```bash
cd merchant-pos
pnpm dev:stack
```

This runs **invoice-backend** on `http://localhost:7071` and **Next** on `http://localhost:3000` in one terminal (`Ctrl+C` stops both). Equivalent: `./scripts/dev-stack.sh` from the repo root.

Use `pnpm dev` only if you already have the invoice API running elsewhere.

### E2E / Playwright (not in git)

The repo **does not track** the Playwright package (`/e2e-testing/`), root test reports, or optional Preprod desk sources under `merchant-pos` (see root **`.gitignore`**). Keep any local copies for your own runs; they will not be committed.

---

## Hydra L2 Payment Integration

### Overview

The PoS system now supports **Hydra Layer-2 settlement** for instant ADA/CNT payments with automatic **L1 fallback** when Hydra is unavailable. The integration is fully transparent to merchants — payments route through Hydra when available and fall back to standard Cardano L1 without breaking the flow.

### Hydra Client SDK

A full TypeScript port of the Hydra protocol client lives in `merchant-pos/src/server/hydra/`:

| Module | Purpose |
|--------|---------|
| `config.ts` | Connection config (host/port/TLS), URI builders |
| `types.ts` | Discriminated union message types (Greetings, TxValid, TxInvalid, Snapshot, etc.) |
| `parser.ts` | JSON frame parser: hydra-node WebSocket → typed messages |
| `client-input.ts` | Protocol input builders (Init, NewTx, Close, Fanout, Contest, etc.) |
| `session.ts` | Raw WebSocket lifecycle |
| `reconnecting-session.ts` | Auto-reconnect with exponential backoff (200ms initial, 3s cap) |
| `seq-tracker.ts` | Message deduplication across reconnects |
| `hydra-http.ts` | 13 REST endpoints (getHeadState, postTransaction, postCommit, etc.) |
| `hydra-head-facade.ts` | High-level orchestration composing WS + HTTP + seq tracking |
| `payment-router.ts` | Hybrid L1/L2 selector with L2 tx submission |
| `singleton.ts` | Lazy singleton with env-based config and metrics wiring |
| `metrics.ts` | Transaction speed, stability, and fallback event recording |
| `feedback-store.ts` | Merchant pilot feedback collection |

### Hybrid L1/L2 Routing

Payment routing logic (per `fr-060`, `fr-061` from the requirements spec):

1. On `POST /api/payment`, the router checks if Hydra is enabled, connected, and the head is `Open`
2. If available and `prefer_hydra: true` (default), the payment is created with `settlement_layer: "L2"`
3. If Hydra is unavailable, the payment automatically routes to `settlement_layer: "L1"` with a `l1_fallback_reason`
4. L2 payments are confirmed via Hydra WebSocket (`TxValid`/`TxInvalid`) with a 5-second timeout
5. If L2 submission fails, the payment falls back to L1 Blockfrost polling

### CNT Support on L2

CNT (Cardano Native Token) transactions on L2 work identically to ADA — the Hydra head processes any valid Cardano transaction CBOR. The transaction is built by the CIP-30 wallet (which handles multi-asset outputs), signed, and submitted as CBOR hex to the Hydra node's `/transaction` endpoint. The asset representation (`{ unit: "<policyId>.<assetNameHex>", quantity: "..." }`) is consistent across L1 and L2.

### Hydra API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/hydra/status` | GET | Hydra head health (available, headState, connectionState) |
| `/api/hydra/submit` | POST | Submit signed L2 transaction (`{ tx_id, cbor_hex }`) |
| `/api/hydra/metrics` | GET | Pilot metrics summary (tx counts, avg times, fallback data) |
| `/api/hydra/feedback` | GET/POST | Merchant UX feedback (rating + comments) |
| `/api/hydra/pilot-report.pdf` | GET | Generated PDF pilot report with all metrics |

### Payment Record Fields (Extended)

| Field | Type | Description |
|-------|------|-------------|
| `settlement_layer` | `"L1"` \| `"L2"` | Which layer settled this payment |
| `hydra_status` | `"pending"` \| `"confirmed"` \| `"failed"` | L2 settlement status |
| `hydra_tx_id` | string | Hydra transaction ID on confirmation |
| `hydra_confirmed_at` | ISO8601 | When L2/L1 confirmation was recorded |
| `l1_fallback_reason` | string | Why the payment fell back to L1 |
| `created_at` | ISO8601 | Payment creation timestamp |

### Hydra Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `HYDRA_ENABLE` | No | `false` | Enable Hydra L2 subsystem |
| `HYDRA_NODE_HOST` | If enabled | — | Hydra node hostname |
| `HYDRA_NODE_PORT` | No | `4001` | Hydra node API port |
| `HYDRA_NODE_SECURE` | No | `false` | Use WSS/HTTPS |
| `NEXT_PUBLIC_HYDRA_ENABLED` | No | `false` | Show L2 UI elements in browser |

### Pilot Infrastructure

Two Docker Compose configurations for testing:

- `docker/docker-compose.preprod.yml` — Preprod testnet (magic=1)
- `docker/docker-compose.preview.yml` — Preview testnet (magic=2)

Each stack includes: cardano-node, hydra-node (v0.20.0), invoice-backend, and merchant-pos.

See [`docs/HYDRA_TESTNET_DEMO.md`](./docs/HYDRA_TESTNET_DEMO.md) for the full demo walkthrough.

### Metrics & Pilot Report

The metrics collector records:
- **Payment creation** events with settlement layer
- **Payment confirmation** events with confirmation time (ms)
- **L2 fallback** events with reasons
- **Hydra connection** state changes

The pilot report PDF (`GET /api/hydra/pilot-report.pdf`) includes:
1. Executive Summary
2. Transaction Speed Benchmarks (L1 vs L2 avg confirmation times)
3. Stability Metrics (fallback counts, connection events)
4. UX Feedback Summary (ratings, comments)
5. Recommendations

### Invoice Backend Hydra Awareness

The invoice backend validation schema accepts optional Hydra fields on update:
- `settlement_layer` (`"L1"` | `"L2"`)
- `hydra_tx_id` (string)
- `hydra_confirmed_at` (ISO8601 datetime)

---

## API examples (invoice-backend)

### Create invoice (ADA)

```bash
curl -sS -X POST http://localhost:7071/invoices \
  -H 'content-type: application/json' \
  -d '{
    "status": "issued",
    "asset": { "unit": "lovelace", "quantity": "1500000" },
    "customer": { "name": "Alice", "email": "alice@example.com" },
    "reference": "order_123",
    "expiry_at": "2026-12-31T00:00:00.000Z"
  }'
```

### Create invoice (CNT)

```bash
curl -sS -X POST http://localhost:7071/invoices \
  -H 'content-type: application/json' \
  -d '{
    "status": "issued",
    "asset": { "unit": "<policyId>.<assetNameHex>", "quantity": "42" },
    "reference": "order_456"
  }'
```

### Export PDF

```bash
curl -L -o invoice.pdf http://localhost:7071/invoices/<invoice_id>/pdf
```

### Export Excel

```bash
curl -L -o invoices.xlsx http://localhost:7071/exports/invoices.xlsx
```

---

