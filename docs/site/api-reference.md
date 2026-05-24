# API Reference

Two services expose HTTP routes: `invoice-backend` on port `7071` and `merchant-pos` on port `3000`. All bodies are JSON unless noted otherwise.

## invoice-backend

### `GET /health`
Liveness probe. Returns `200 OK` with a small JSON body.

### `GET /invoices`
List every invoice. Query string `?status=…` filters by status (`draft` / `issued` / `pending_payment` / `paid` / `expired` / `cancelled` / `failed`).

### `POST /invoices`
Create an invoice.

Request:
```json
{
  "amount": 12.50,
  "currency": "ADA",
  "customer_email": "alice@example.com",
  "description": "Sandwich and coffee"
}
```

Response:
```json
{
  "id": "inv_OXt…",
  "status": "issued",
  "amount": 12.50,
  "currency": "ADA",
  "created_at": "2026-05-12T08:00:00Z"
}
```

### `GET /invoices/{id}`
Single-invoice details.

### `PATCH /invoices/{id}`
Update mutable fields (status, description, etc.). Server validates state transitions.

### `DELETE /invoices/{id}`
Soft-delete (the record becomes `cancelled`).

### `GET /invoices/{id}/pdf`
Stream the rendered PDF for the invoice.

### `GET /exports/invoices.xlsx`
Stream all invoices as an `.xlsx` workbook.

## merchant-pos (proxy + Hydra)

All endpoints live under `http://<host>:3000/api/`.

### `POST /api/payment`
Create a payment for a given amount.

Request:
```json
{
  "amount": 5,
  "prefer_hydra": true,
  "asset": {
    "policy_id": "<hex>",
    "asset_name": "<hex>",
    "decimals": 6
  }
}
```

Response (Hydra-preferred path):
```json
{
  "tx_id": "tx_…",
  "amount": 5,
  "payment_address": "addr_…",
  "settlement_layer": "L2",
  "hydra_status": "pending",
  "created_at": "2026-05-12T08:00:00Z"
}
```

### `GET /api/payment?tx={tx_id}`
Current status of a payment.

### `GET /api/hydra/status`
```json
{ "available": true, "headState": "Open", "headId": "…", "connectionState": "connected" }
```

### `POST /api/hydra/submit`
Forward a signed CIP-30 transaction into the head.

Request:
```json
{ "tx_id": "tx_…", "cbor_hex": "<signed-cbor-hex>" }
```

### `GET /api/hydra/metrics`
Rolling counters for L1 vs L2 settlement, average L2 confirmation time, fallback events.

### `GET /api/hydra/pilot-report.pdf`
Server-rendered pilot report. Pulls latest metrics + merchant feedback.

### `POST /api/hydra/feedback`
Merchant-side qualitative feedback.

Request:
```json
{ "rating": 5, "comments": "L2 settlement was instant, great UX" }
```

### `GET /api/hydra/feedback`
List all submitted feedback (use with auth in production).

### `GET /api/invoices`, `POST /api/invoices`, `GET /api/invoices/{id}` …
Thin proxies to the `invoice-backend` routes above. Same request/response shapes.

### `GET /api/adaprice`
Returns the current ADA/USD reference rate used for fiat-denominated invoices.

## Error responses

All endpoints use standard HTTP status codes plus a JSON body:

```json
{ "error": "code", "message": "human readable" }
```

Common codes:

- `400 invalid_payload` — request body failed schema validation
- `404 not_found` — invoice or tx id unknown
- `409 invalid_state` — bad invoice status transition
- `503 hydra_unavailable` — hydra-node socket closed; the system falls back to L1 transparently for `/api/payment`, but `/api/hydra/submit` will reject
