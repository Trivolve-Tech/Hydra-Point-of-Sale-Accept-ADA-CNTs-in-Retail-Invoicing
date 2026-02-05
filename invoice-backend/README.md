# invoice-backend

Standalone backend component for **invoice generation + tracking** with **ADA/CNT** amounts and **export to PDF + Excel**.

## Run

```bash
cd invoice-backend
pnpm install
pnpm dev
```

The server listens on `PORT` (default `7071`).

### Environment variables

- `PORT`: server port (default `7071`)
- `DATA_DIR`: where to store `invoices.json` (default `./data`)

## API

### Create invoice

`POST /invoices`

Example:

```json
{
  "status": "issued",
  "asset": { "unit": "lovelace", "quantity": "1500000" },
  "customer": { "name": "Alice", "email": "alice@example.com" },
  "reference": "order_123"
}
```

For CNTs, use a generic unit format like:

```json
{ "unit": "<policyId>.<assetNameHex>", "quantity": "42" }
```

### List invoices

`GET /invoices?status=paid&q=alice&limit=50&offset=0`

### Update invoice

`PATCH /invoices/:id`

### Export

- `GET /invoices/:id/pdf` (downloads a PDF)
- `GET /exports/invoices.xlsx` (downloads an Excel file)

