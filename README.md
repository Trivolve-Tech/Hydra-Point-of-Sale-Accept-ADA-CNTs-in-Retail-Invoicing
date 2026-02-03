# Hydra Point-of-Sale (PoS) + Invoicing (ADA/CNT, Hydra-first)

This repository contains the **requirements** and **technical architecture** for an open-source, self-hosted, non-custodial PoS + invoicing toolkit for **ADA** and **Cardano Native Tokens (CNTs)** with **Hydra Layer-2 settlement** and automatic Layer-1 fallback.

It also includes an **independent invoice backend component** plus an integration layer that fits into the included `merchant-pos` frontend.

## Repository contents

- `Hydra_Point-of-Sale_(PoS)__Invoicing_-_Requirements_Specification_Document.pdf`: functional + non-functional requirements
- `Hydra_Point-of-Sale_(PoS)__Invoicing_Technical_architecture_and_design.pdf`: reference architecture, components, data model, and API/event examples
- `merchant-pos/`: a Next.js UI (payment gateway-style) extended with invoice API proxy routes
- `invoice-backend/`: a standalone REST service for invoice CRUD + exports (PDF + Excel)

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

## merchant-pos integration

`merchant-pos` exposes proxy endpoints so the frontend can call invoices through its own Next.js API routes.

### Configure

Set:

- `INVOICE_BACKEND_URL=http://localhost:7071`

In `merchant-pos/.env.example` this is included as a reference.

### Available proxy routes

- `GET/POST /api/invoices` → `invoice-backend /invoices`
- `GET/PATCH/DELETE /api/invoices/:id` → `invoice-backend /invoices/:id`
- `GET /api/invoices/:id/pdf` → `invoice-backend /invoices/:id/pdf`
- `GET /api/exports/invoices.xlsx` → `invoice-backend /exports/invoices.xlsx`
