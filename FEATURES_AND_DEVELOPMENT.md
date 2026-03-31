## Hydra PoS + Invoicing: Feature & Development Documentation

This repository contains two reference PDFs plus working code components that implement an **invoice generation + tracking** backend and a **merchant UI** with API proxy routes.

### What’s in this repo

- **Requirements**: `Hydra_Point-of-Sale_(PoS)__Invoicing_-_Requirements_Specification_Document.pdf`
- **Architecture**: `Hydra_Point-of-Sale_(PoS)__Invoicing_Technical_architecture_and_design.pdf`
- **Frontend (baseline + integration)**: `merchant-pos/` (Next.js)
- **Backend (invoicing)**: `invoice-backend/` (Node/Express)

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

Set:
- `INVOICE_BACKEND_URL=http://localhost:7071`

Then run it using your preferred package manager for `merchant-pos` (its lockfile is `pnpm-lock.yaml`).

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

