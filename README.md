# Hydra Point-of-Sale (PoS) + Invoicing (ADA/CNT, Hydra-first)

This repository contains the **requirements** and **technical architecture** for an open-source, self-hosted, non-custodial PoS + invoicing toolkit for **ADA** and **Cardano Native Tokens (CNTs)** with **Hydra Layer-2 settlement** and automatic Layer-1 fallback.

It also includes an **independent invoice backend**, a **Next.js merchant UI** with invoice API proxies, and **CIP-30 browser wallet** integration (via [Mesh](https://meshjs.dev/)) for in-browser payment initiation on Cardano L1.

**Detailed feature list, file map, and API examples:** see [`FEATURES_AND_DEVELOPMENT.md`](./FEATURES_AND_DEVELOPMENT.md).

## Repository contents

| Area | Path | Notes |
|------|------|--------|
| Requirements PDF | `Hydra_Point-of-Sale_(PoS)__Invoicing_-_Requirements_Specification_Document.pdf` | Functional + non-functional requirements |
| Architecture PDF | `Hydra_Point-of-Sale_(PoS)__Invoicing_Technical_architecture_and_design.pdf` | Components, data model, API/event examples |
| Merchant UI | `merchant-pos/` | Next.js PoS-style UI, invoice proxies, Mesh wallet connect, “Pay with wallet” |
| Invoicing API | `invoice-backend/` | Standalone REST: CRUD + PDF + Excel |
| Feature & dev doc | [`FEATURES_AND_DEVELOPMENT.md`](./FEATURES_AND_DEVELOPMENT.md) | Wallet/payment wiring, env vars, `curl` examples |
| Milestone demo videos | [`docs/demo-videos/`](./docs/demo-videos/) | MP4 PoA + [`docs/demo-videos/README.md`](./docs/demo-videos/README.md) |

### Wallet connect + in-browser payment (evidence pointers)

- **CIP-30 picker (Nami, Eternl, Lace, Flint, …):** `merchant-pos/src/components/mesh/MeshWalletConnect.tsx` (lazy-loaded from `dynamic-mesh.tsx`).
- **Mesh provider (client-only):** `merchant-pos/src/pages/_app.tsx`.
- **Checkout “Pay with wallet”:** `merchant-pos/src/components/mesh/PayWithWalletButton.tsx` + `payment-modal.tsx`.
- **Browser network + Blockfrost:** `merchant-pos/src/lib/cardano-browser-config.ts` (`NEXT_PUBLIC_CARDANO_NETWORK`, `NEXT_PUBLIC_BLOCKFROST_PROJECT_ID`).
- **Server-side payment intent + on-chain status:** `merchant-pos/src/pages/api/payment.ts`, `merchant-pos/src/server/cardano.ts`.

## invoice-backend (standalone service)

### Features

- Create/list/get/update/delete invoices
- Invoice statuses: `draft`, `issued`, `pending_payment`, `paid`, `expired`, `cancelled`, `failed`
- ADA/CNT amounts (generic representation):
  - ADA: `{ "unit": "lovelace", "quantity": "<base-unit-integer>" }`
  - CNT: `{ "unit": "<policyId>.<assetNameHex>", "quantity": "<base-unit-integer>" }`
- Exports:
  - `GET /invoices/:id/pdf`
  - `GET /exports/invoices.xlsx`

### Run

```bash
cd invoice-backend
npm install
node ./src/index.js
```

Server listens on `PORT` (default `7071`).

## merchant-pos

### Features (high level)

- **Invoices:** proxy routes to `invoice-backend` (same paths under `/api/invoices`, exports, PDF).
- **Payments:** `POST /api/payment` creates a payment intent; `GET /api/payment?tx=…` returns stored intent plus on-chain check and optional Cardanoscan link when paid.
- **Wallets:** Mesh `CardanoWallet` + `PayWithWalletButton` for user-signed L1 transfers when public Blockfrost env is set.

### Configure

Copy `merchant-pos/.env.example` to `merchant-pos/.env` and set at least:

- **`INVOICE_BACKEND_URL`** — e.g. `http://localhost:7071`
- **Server chain / treasury (payment intent + monitoring):** `WALLET_SEED_PHRASE`, `BLOCKFROST_KEY`, and typically `CARDANO_NETWORK` (`mainnet` \| `preprod` \| `preview`) plus `BLOCKFROST_URL` if not using the default Blockfrost host (see [`FEATURES_AND_DEVELOPMENT.md`](./FEATURES_AND_DEVELOPMENT.md)).
- **Browser “Pay with wallet” (optional but required for that button):**
  - `NEXT_PUBLIC_BLOCKFROST_PROJECT_ID` — Blockfrost project id for the **browser** bundle (use a dedicated key; rate-limit appropriately).
  - `NEXT_PUBLIC_CARDANO_NETWORK` — `mainnet`, `preprod`, or `preview`; must match the wallet network and the Blockfrost project.

### Run (UI + invoice backend together)

From `merchant-pos/` after `pnpm install` and `npm install` in `invoice-backend/`:

```bash
cd merchant-pos
pnpm dev:stack
```

Runs **invoice-backend** on `http://localhost:7071` and **Next.js** on `http://localhost:3000`. Use `pnpm dev` only if the invoice API is already running elsewhere.

### Proxy routes (invoices)

- `GET/POST /api/invoices` → `invoice-backend /invoices`
- `GET/PATCH/DELETE /api/invoices/:id` → `invoice-backend /invoices/:id`
- `GET /api/invoices/:id/pdf` → `invoice-backend /invoices/:id/pdf`
- `GET /api/exports/invoices.xlsx` → `invoice-backend /exports/invoices.xlsx`

## License

See [`LICENSE`](./LICENSE).
