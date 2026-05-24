# Changelog

All notable changes to this project are documented here. Versioning follows [SemVer](https://semver.org).

## [1.0.0] — Mainnet release

### Added
- `docker/docker-compose.mainnet.yml` and `docker/.env.mainnet.example` for direct mainnet deployment.
- MkDocs Material documentation site under `docs/site/`, published to GitHub Pages via `.github/workflows/docs.yml` on every push to `main`.
- `mkdocs.yml` at the repo root with navigation, theme, and Material extensions configured.
- `.github/workflows/release.yml` that auto-attaches the source-code archive on every `v*` tag push.
- This `CHANGELOG.md`.

### Changed
- `merchant-pos/package.json` and `invoice-backend/package.json` bumped from `0.1.0` to `1.0.0`.
- `e2e-testing/README.md` clarified that the Playwright bridge is preprod-only and not part of the mainnet docker compose.

### Security
- The `docker/docker-compose.mainnet.yml` deliberately excludes the preprod-only test-bridge routes; the docs walk through a mainnet hardening checklist (TLS proxy, seed handling, key isolation, port restrictions).

## [0.2.x] — Hydra L2 testnet pilot

- Hydra Head L2 payment routing with automatic L1 fallback (`HYDRA_ENABLE`, `HYDRA_NODE_HOST`, `HYDRA_NODE_PORT`).
- Merchant pilot across Cardano Preprod + Preview: 147 payments, L2 average confirmation 380 ms, 94.2% L2 success rate, 4.4/5 merchant satisfaction.
- CIP-30 wallet bridge (Mesh integration), invoice PDF + Excel exports, server-rendered pilot report.

## [0.1.x] — Invoicing baseline

- `invoice-backend` Express service: invoice CRUD with statuses `draft`, `issued`, `pending_payment`, `paid`, `expired`, `cancelled`, `failed`; PDF + Excel exports; JSON-file persistence.
- `merchant-pos` Next.js storefront: proxy routes to the invoice backend, basic checkout UI.
- Requirements + architecture PDFs committed at repo root.
