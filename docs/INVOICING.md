## Invoicing component notes

This repo currently provides an independent invoicing backend (`invoice-backend/`) that implements:

- **Invoice CRUD** (`/invoices`)
- **Statuses**: `draft`, `issued`, `pending_payment`, `paid`, `expired`, `cancelled`, `failed`
- **Exports**:
  - PDF: `/invoices/:id/pdf`
  - Excel: `/exports/invoices.xlsx`

### Asset representation (ADA/CNT)

The backend stores amounts as **base-unit integers** to avoid floating-point issues:

- **ADA** uses:
  - `unit`: `lovelace`
  - `quantity`: integer string (e.g. `"1500000"` for 1.5 ADA)
- **CNTs** use a generic identifier:
  - `unit`: `<policyId>.<assetNameHex>`
  - `quantity`: integer string

### Example requests

Create an invoice:

```bash
curl -sS -X POST http://localhost:7071/invoices \\\n+  -H 'content-type: application/json' \\\n+  -d '{\n+    \"status\": \"issued\",\n+    \"asset\": { \"unit\": \"lovelace\", \"quantity\": \"1500000\" },\n+    \"customer\": { \"name\": \"Alice\", \"email\": \"alice@example.com\" },\n+    \"reference\": \"order_123\",\n+    \"expiry_at\": \"2026-12-31T00:00:00.000Z\"\n+  }'\n+```\n+
Export the invoice as PDF:

```bash
curl -L -o invoice.pdf http://localhost:7071/invoices/<invoice_id>/pdf
```

Export all invoices as Excel:

```bash
curl -L -o invoices.xlsx http://localhost:7071/exports/invoices.xlsx
```

