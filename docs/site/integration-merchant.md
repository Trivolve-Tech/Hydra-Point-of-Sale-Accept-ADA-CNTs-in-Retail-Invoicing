# Integration — Merchant

Two ways to integrate, ordered by effort: drop the merchant-pos in front of your existing storefront as a payment surface, or call the invoice-backend HTTP API directly from your own UI.

## Option A: drop-in merchant-pos

You already have a storefront; you want a Cardano + Hydra checkout page without writing wallet code.

1. Deploy the `docker/docker-compose.mainnet.yml` stack on a host you control.
2. Front it with a TLS reverse proxy (Caddy, nginx, or a CDN edge).
3. Link the customer from your storefront checkout to `https://<your-host>/checkout?invoiceId=<id>` after creating the invoice (next section).

merchant-pos handles wallet connect, Hydra L2 routing, L1 fallback, and PDF receipts.

## Option B: call the invoice-backend API directly

You want full UI control and only need invoicing + status webhooks.

```bash
# 1. Create an invoice
curl -X POST http://<backend-host>:7071/invoices \
  -H 'Content-Type: application/json' \
  -d '{
        "amount": 12.50,
        "currency": "ADA",
        "customer_email": "alice@example.com",
        "description": "Sandwich and coffee"
      }'
# → { "id": "inv_…", "status": "issued", … }

# 2. Render the invoice as PDF
curl http://<backend-host>:7071/invoices/<id>/pdf -o invoice.pdf

# 3. List + export
curl http://<backend-host>:7071/invoices
curl http://<backend-host>:7071/exports/invoices.xlsx -o invoices.xlsx
```

See [API Reference](api-reference.md) for the full schema.

## Configuration knobs

Setting these in `docker/.env.mainnet` (or in your environment manager) covers every supported merchant flow:

| Env var | Where | Purpose |
|---|---|---|
| `CARDANO_NETWORK` | server | `mainnet` / `preprod` / `preview` |
| `BLOCKFROST_KEY`, `BLOCKFROST_URL` | server | L1 chain queries |
| `WALLET_SEED_PHRASE` | server | Operator wallet (used for L1 commits to the head) |
| `HYDRA_ENABLE` | server | Toggle the L2 path on/off without redeploying |
| `HYDRA_NODE_HOST`, `HYDRA_NODE_PORT` | server | Where to reach the hydra-node API |
| `INVOICE_BACKEND_URL` | server | merchant-pos → invoice-backend HTTP root |
| `NEXT_PUBLIC_CARDANO_NETWORK` | browser | UI wallet bridge target |
| `NEXT_PUBLIC_BLOCKFROST_PROJECT_ID` | browser | Browser-side queries (kept narrow) |
| `NEXT_PUBLIC_HYDRA_ENABLED` | browser | Show L2 affordances in the customer UI |

## Status callbacks

`merchant-pos` polls `api/payment?tx=…` until settlement. To skip polling on the merchant side, listen to the `api/hydra/status` WebSocket (or wire a webhook target into your reverse proxy) and pull status by invoice id from `invoice-backend`. Invoice statuses transition: `draft → issued → pending_payment → paid` (or `expired` / `cancelled` / `failed`).

## Branding

The merchant-pos UI uses Tailwind utility classes. Override the theme by editing `merchant-pos/src/styles/globals.css` and the wordmark in `merchant-pos/src/components/Header.tsx` (or whichever component your branding lives in for your fork).
