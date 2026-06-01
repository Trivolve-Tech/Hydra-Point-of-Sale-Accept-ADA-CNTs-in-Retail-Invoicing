# Hydra Point-of-Sale (PoS) + Invoicing — Mainnet

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)

> Self-hosted, open-source point-of-sale + invoicing toolkit for **ADA** and
> **Cardano Native Tokens (CNTs)** with **Hydra Layer-2 settlement** on
> Cardano mainnet. Real ADA, real Hydra heads, real CIP-30 wallets.

The system is **L1 non-custodial, L2 server-signed**: customers sign every L1
transaction with their own wallet (Vespr / Eternl / Lace …); the server holds
a per-customer ed25519 spend key that signs in-head L2 transactions. This
hybrid model is the only design that works with current CIP-30 wallets, which
refuse to sign for UTxOs that don't exist on L1 (see
[docs/architecture/hybrid-custody.md](docs/architecture/hybrid-custody.md)).

| Aspect | Detail |
|---|---|
| Cardano network | mainnet (preprod template included for testing) |
| Hydra protocol version | 1.3.0 |
| L1 wallet integration | CIP-30 (Mesh SDK — Vespr, Eternl, Lace, Nami, Flint…) |
| L2 signing | Server-held ed25519 key per customer, AES-256-GCM at rest |
| Database | Postgres + Drizzle ORM |
| Web stack | Next.js 15 (single app serves merchant + customer dashboards) |
| L1 submission | Blockfrost (mainnet project key required) |

## Quick start

```bash
git clone <this-repo>
cd Hydra-Point-of-Sale-Accept-ADA-CNTs-in-Retail-Invoicing

# Fetch the Cardano mainnet genesis bundle (not vendored — public, ~1 MB)
./scripts/fetch-cardano-mainnet-config.sh

# Mainnet configuration
cp docker/.env.mainnet.example docker/.env.mainnet
$EDITOR docker/.env.mainnet        # fill in Blockfrost key, HPOS_KEY_SECRET, etc.

docker compose --env-file docker/.env.mainnet \
  -f docker/docker-compose.mainnet.yml up -d

# When the cardano-node has caught up to the tip (~150 GB sync), open
# the orchestrator endpoint to bring up a Hydra head:
curl -X POST http://localhost:3000/api/heads/open
```

The merchant dashboard lives at `https://merchant.local` (route through your
own reverse proxy + DNS or a Cloudflare tunnel), and the customer payment
page at `https://customer.local`. Until you set them up, both are reachable
directly on `http://localhost:3000` (`/` is merchant, `/customer` is customer).

> **You'll need ~150 GB of disk** for the mainnet chain and ~5 ADA per
> Hydra head you plan to open (cardano-node fees for the Init/Commit/Close
> txns). Read [`docs/architecture/hybrid-custody.md`](docs/architecture/hybrid-custody.md)
> end to end before sending real ADA.

## What's in the box

| Path | What it is |
|---|---|
| [`merchant-pos/`](./merchant-pos/) | Next.js app. Serves both the merchant dashboard (`/`) and the customer payment page (`/customer`). All HTTP API endpoints under `/api/*`. |
| [`merchant-pos/src/server/`](./merchant-pos/src/server/) | Hydra-node WebSocket session manager, customer-profile module (per-customer L2 spend keys), Cardano tx builders, payment-router, in-head tx builder + signer, L1 submitter, Postgres data layer. |
| [`docker/docker-compose.mainnet.yml`](./docker/docker-compose.mainnet.yml) | One-shot bring-up: Postgres + cardano-node + the Next.js app. |
| [`docker/compose.head.tmpl.yml`](./docker/compose.head.tmpl.yml) | Per-head template the orchestrator instantiates for each `(merchant, customer)` Hydra head. |
| [`hydra-config/protocol-parameters.json`](./hydra-config/protocol-parameters.json) | In-head ledger protocol parameters (fees/sizes used when building L2 transactions). |
| [`scripts/derive-merchant-addresses.ts`](./scripts/derive-merchant-addresses.ts) | Derive the operator BIP-39 wallet's per-head fee-funding addresses (so you can pre-fund them before opening each head). |
| [`scripts/reconcile.ts`](./scripts/reconcile.ts) | Reconcile DB intent state vs hydra-node `/snapshot/utxo`. |
| [`docs/`](./docs/) | Architecture, operations playbook, key custody, mainnet deployment guide. |
| [`legacy-invoice-backend/`](./legacy-invoice-backend/) | The original v0 Express invoice CRUD service. Superseded by `/api/invoices` in the Next.js app; kept for reference. |

## Documentation map

- [Hybrid custody architecture](docs/architecture/hybrid-custody.md) — read this first
- [Mainnet deployment guide](docs/ops/mainnet-deployment.md)
- [Key custody policy](docs/ops/key-custody.md)
- [Incident playbook](docs/ops/incident-playbook.md)
- [Tuning `--deposit-period`](docs/ops/deposit-period-tuning.md)
- [HTTP API reference](docs/api-reference.md)

## Repository layout

```
.
├── docker/                       Docker Compose stacks for L1 services
│   ├── docker-compose.mainnet.yml
│   ├── docker-compose.preprod.yml
│   ├── compose.head.tmpl.yml     Per-Hydra-head template
│   ├── heads/                    Generated per-head compose files (gitignored)
│   ├── Dockerfile.merchant-pos
│   └── hydra-node/entrypoint.sh
├── merchant-pos/                 Next.js app (merchant + customer + API)
│   ├── src/
│   │   ├── pages/                Routes
│   │   ├── pages/api/            HTTP endpoints
│   │   ├── server/               Hydra session, tx builders, Postgres
│   │   └── components/           UI (Mesh wallet, gradient cards, …)
│   ├── public/                   Fonts, logos, ADA/CNT icons
│   ├── drizzle.config.ts
│   ├── package.json
│   └── .env.example
├── hydra-config/
│   └── protocol-parameters.json  In-head ledger parameters
├── docs/                         Markdown docs (architecture, ops, API)
├── scripts/                      One-shot operator scripts
├── legacy-invoice-backend/       (legacy v0, superseded)
└── README.md
```

## License

[MIT](./LICENSE).
