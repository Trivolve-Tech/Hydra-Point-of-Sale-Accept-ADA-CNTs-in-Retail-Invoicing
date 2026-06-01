# Changelog

All notable changes to this project are documented here. Versioning follows [SemVer](https://semver.org).

## [2.0.0] — Hybrid-custody mainnet rewrite

**Breaking, end-to-end rewrite.** The codebase has been replaced with the
implementation that actually works on mainnet against CIP-30 wallets and
hydra-node 1.3.0. See [`docs/architecture/hybrid-custody.md`](docs/architecture/hybrid-custody.md)
for the model.

### Added
- **Hybrid custody architecture.** Per-customer ed25519 spend keys generated
  at profile creation, AES-256-GCM encrypted at rest in the `customers`
  table. L1 commits are non-custodial (wallet-signed); L2 spends are
  server-signed.
- **`POST /api/heads/[id]/commit-deposit`** — server picks the L1 UTxO at
  the customer's deposit address, asks hydra-node `/commit` for a draft,
  signs with the per-customer key, submits to Blockfrost.
- **`POST /api/intents/[tx]/pay`** — server builds + signs the in-head
  transfer and submits to hydra-node `/transaction`. Accepts the v1.3
  `202 SubmitTxSubmitted` response as success.
- **Six-step commit progress stepper** on the customer page with live
  elapsed/ETA timers and per-step status.
- **Postgres + Drizzle ORM** data layer.
- **Per-head docker-compose orchestrator** ([`merchant-pos/src/server/orchestrator`](merchant-pos/src/server/orchestrator)).
- **Sanitised `.env.{mainnet,preprod}.example`** with every required value
  documented inline (Blockfrost, HPOS_KEY_SECRET, deposit-period, etc.).
- New docs: [hybrid custody](docs/architecture/hybrid-custody.md),
  [deposit-period tuning](docs/ops/deposit-period-tuning.md),
  [mainnet deployment](docs/ops/mainnet-deployment.md),
  [key custody](docs/ops/key-custody.md),
  [incident playbook](docs/ops/incident-playbook.md).
- `scripts/fetch-cardano-mainnet-config.sh` to pull the public mainnet
  genesis bundle (not vendored).
- `scripts/derive-merchant-addresses.ts` is now env-driven (no hardcoded
  `/root/...` paths) and prints addresses for both merchant and customer
  account paths.
- `scripts/reconcile.ts` to cross-check intent state vs hydra-node
  `/snapshot/utxo`.

### Changed
- **`merchant-pos/` is now a single Next.js app** that serves both the
  merchant dashboard (`/`) and the customer page (`/customer`), with all
  HTTP API endpoints under `/api/*`. The previous Supabase + invoice-backend
  split is gone.
- `merchant-pos/src/middleware.ts` fails closed when `SITE_PASSWORD_MERCHANT`
  is unset (no default password ships any more).
- Default `--deposit-period` raised from 60 s to **300 s** so the snapshot
  leader has time to incorporate the deposit before it expires (verified
  failing at 60 s on mainnet).
- L2 transaction signing now uses `csl.FixedTransaction.sign_and_add_vkey_signature`
  so the original body bytes are preserved (re-serialising `TransactionBody`
  produced subtly different bytes and broke the body hash).
- All `process.env`-driven paths now have repo-relative defaults; nothing
  in the code references a `/root/...` operator path.

### Removed
- `invoice-backend/` (the old Express CRUD service). Moved to
  `legacy-invoice-backend/` for reference; the Next.js app provides
  `/api/invoices` natively.
- `handoff.md` (session-specific operator notes; replaced by
  `docs/ops/mainnet-deployment.md`).
- Supabase dependency. Postgres is used directly via Drizzle.
- All recording / pilot-report scripts that depended on the legacy stack.

### Security
- `HPOS_KEY_SECRET` (32-byte AES-GCM key) is required and the customer-profile
  module refuses to start without it.
- No defaults for `WALLET_SEED_PHRASE`, `BLOCKFROST_KEY`, `SITE_PASSWORD_MERCHANT`,
  or `HPOS_KEY_SECRET` — empty values fail closed.
- All previously committed test credentials (Blockfrost project id, mnemonics,
  default basic-auth passwords) have been removed from git history's tip and
  rotated.

## [1.0.0] — Mainnet release (legacy, superseded by 2.0.0)

- See git history.

## [0.2.x] — Hydra L2 testnet pilot

- Hydra Head L2 payment routing with automatic L1 fallback.
- Merchant pilot across Cardano Preprod + Preview.

## [0.1.x] — Invoicing baseline

- `invoice-backend` Express service: invoice CRUD with statuses; PDF + Excel
  exports; JSON-file persistence.
- `merchant-pos` Next.js storefront: proxy routes to the invoice backend.
- Requirements + architecture PDFs committed at repo root.
