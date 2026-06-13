# Project Completion Report

## Hydra Point-of-Sale: Accept ADA, CNTs in Retail & Invoicing

| Field | Value |
|---|---|
| **Project Name** | Hydra Point-of-Sale: Accept ADA, CNTs in Retail & Invoicing |
| **Project Number** | 1400065 |
| **Challenge** | F14: Cardano Open: Developers |
| **Project Manager** | Rahul Konudula |
| **Project Start Date** | November 24, 2025 |
| **Project Completion Date** | June 1, 2026 |
| **Repository** | [github.com/Trivolve-Tech/Hydra-Point-of-Sale-Accept-ADA-CNTs-in-Retail-Invoicing](https://github.com/Trivolve-Tech/Hydra-Point-of-Sale-Accept-ADA-CNTs-in-Retail-Invoicing) |
| **Documentation site** | [trivolve-tech.github.io/Hydra-Point-of-Sale-…](https://trivolve-tech.github.io/Hydra-Point-of-Sale-Accept-ADA-CNTs-in-Retail-Invoicing/) |

---

## 1. Deliverables

The Hydra Point-of-Sale project delivered a **self-hosted, open-source point-of-sale + invoicing toolkit** that accepts **ADA and Cardano Native Tokens (CNTs)** with **Hydra Layer-2 settlement on Cardano mainnet**. The system ships a single Next.js application that serves both a merchant dashboard and a customer payment page, plus a per-customer Hydra-head orchestrator and a sanitised mainnet docker-compose stack. Real ADA, real Hydra heads, real CIP-30 wallets — and rolled out for live retail payments at the **Sova Bar (Da Nang) launch event**.

### Single URL hosting all outputs

**Documentation site (GitHub Pages):** [https://trivolve-tech.github.io/Hydra-Point-of-Sale-Accept-ADA-CNTs-in-Retail-Invoicing/](https://trivolve-tech.github.io/Hydra-Point-of-Sale-Accept-ADA-CNTs-in-Retail-Invoicing/)

### Off-chain evidence — code, documentation, and releases

| Output | Link |
|---|---|
| Source repository | [github.com/Trivolve-Tech/Hydra-Point-of-Sale-Accept-ADA-CNTs-in-Retail-Invoicing](https://github.com/Trivolve-Tech/Hydra-Point-of-Sale-Accept-ADA-CNTs-in-Retail-Invoicing) |
| **v1.0.0 release** (mainnet baseline) | [Releases — v1.0.0](https://github.com/Trivolve-Tech/Hydra-Point-of-Sale-Accept-ADA-CNTs-in-Retail-Invoicing/releases/tag/v1.0.0) |
| **v2.0.0 release** (hybrid-custody mainnet rewrite — better retail + business UX) | [Releases — v2.0.0](https://github.com/Trivolve-Tech/Hydra-Point-of-Sale-Accept-ADA-CNTs-in-Retail-Invoicing/releases/tag/v2.0.0) |
| Project README | [README.md](https://github.com/Trivolve-Tech/Hydra-Point-of-Sale-Accept-ADA-CNTs-in-Retail-Invoicing/blob/main/README.md) |
| Changelog (SemVer) | [CHANGELOG.md](https://github.com/Trivolve-Tech/Hydra-Point-of-Sale-Accept-ADA-CNTs-in-Retail-Invoicing/blob/main/CHANGELOG.md) |
| Launch-event Feedback | [docs/FEEDBACK.md](https://github.com/Trivolve-Tech/Hydra-Point-of-Sale-Accept-ADA-CNTs-in-Retail-Invoicing/blob/main/docs/FEEDBACK.md) |
| Hybrid-custody architecture | [docs/architecture/hybrid-custody.md](https://github.com/Trivolve-Tech/Hydra-Point-of-Sale-Accept-ADA-CNTs-in-Retail-Invoicing/blob/main/docs/architecture/hybrid-custody.md) |
| Mainnet deployment guide | [docs/ops/mainnet-deployment.md](https://github.com/Trivolve-Tech/Hydra-Point-of-Sale-Accept-ADA-CNTs-in-Retail-Invoicing/blob/main/docs/ops/mainnet-deployment.md) |
| Key custody policy | [docs/ops/key-custody.md](https://github.com/Trivolve-Tech/Hydra-Point-of-Sale-Accept-ADA-CNTs-in-Retail-Invoicing/blob/main/docs/ops/key-custody.md) |
| Incident playbook | [docs/ops/incident-playbook.md](https://github.com/Trivolve-Tech/Hydra-Point-of-Sale-Accept-ADA-CNTs-in-Retail-Invoicing/blob/main/docs/ops/incident-playbook.md) |
| `--deposit-period` tuning | [docs/ops/deposit-period-tuning.md](https://github.com/Trivolve-Tech/Hydra-Point-of-Sale-Accept-ADA-CNTs-in-Retail-Invoicing/blob/main/docs/ops/deposit-period-tuning.md) |
| Merchant + customer + API surface | [merchant-pos/src/server/](https://github.com/Trivolve-Tech/Hydra-Point-of-Sale-Accept-ADA-CNTs-in-Retail-Invoicing/tree/main/merchant-pos/src/server) |
| In-app demo videos | [docs/demo-videos/](https://github.com/Trivolve-Tech/Hydra-Point-of-Sale-Accept-ADA-CNTs-in-Retail-Invoicing/tree/main/docs/demo-videos) |

### Specification PDFs (in-repo)

| PDF | Direct link |
|---|---|
| Requirements Specification Document | [Hydra_Point-of-Sale_(PoS)__Invoicing_-_Requirements_Specification_Document.pdf](https://github.com/Trivolve-Tech/Hydra-Point-of-Sale-Accept-ADA-CNTs-in-Retail-Invoicing/blob/main/Hydra_Point-of-Sale_(PoS)__Invoicing_-_Requirements_Specification_Document.pdf) |
| Technical Architecture & Design | [Hydra_Point-of-Sale_(PoS)__Invoicing_Technical_architecture_and_design.pdf](https://github.com/Trivolve-Tech/Hydra-Point-of-Sale-Accept-ADA-CNTs-in-Retail-Invoicing/blob/main/Hydra_Point-of-Sale_(PoS)__Invoicing_Technical_architecture_and_design.pdf) |

### Component inventory (v2.0.0)

| Path | Purpose |
|---|---|
| [`merchant-pos/`](https://github.com/Trivolve-Tech/Hydra-Point-of-Sale-Accept-ADA-CNTs-in-Retail-Invoicing/tree/main/merchant-pos) | Next.js 15 app serving both the merchant dashboard (`/`) and the customer payment page (`/customer`); HTTP API under `/api/*` |
| [`merchant-pos/src/server/`](https://github.com/Trivolve-Tech/Hydra-Point-of-Sale-Accept-ADA-CNTs-in-Retail-Invoicing/tree/main/merchant-pos/src/server) | `hydra-node` WS session manager, per-customer L2 spend-key profile module, Cardano tx builders, payment router, in-head signer, L1 submitter, Postgres data layer (Drizzle ORM) |
| [`docker/docker-compose.mainnet.yml`](https://github.com/Trivolve-Tech/Hydra-Point-of-Sale-Accept-ADA-CNTs-in-Retail-Invoicing/blob/main/docker/docker-compose.mainnet.yml) | One-shot bring-up of Postgres + `cardano-node` + the Next.js app on mainnet |
| [`docker/compose.head.tmpl.yml`](https://github.com/Trivolve-Tech/Hydra-Point-of-Sale-Accept-ADA-CNTs-in-Retail-Invoicing/blob/main/docker/compose.head.tmpl.yml) | Per-`(merchant, customer)` Hydra-head template the orchestrator instantiates |
| [`hydra-config/protocol-parameters.json`](https://github.com/Trivolve-Tech/Hydra-Point-of-Sale-Accept-ADA-CNTs-in-Retail-Invoicing/blob/main/hydra-config/protocol-parameters.json) | In-head ledger protocol parameters used when building L2 transactions |
| [`scripts/derive-merchant-addresses.ts`](https://github.com/Trivolve-Tech/Hydra-Point-of-Sale-Accept-ADA-CNTs-in-Retail-Invoicing/blob/main/scripts/derive-merchant-addresses.ts) | Derive operator BIP-39 wallet's per-head fee-funding addresses |
| [`scripts/reconcile.ts`](https://github.com/Trivolve-Tech/Hydra-Point-of-Sale-Accept-ADA-CNTs-in-Retail-Invoicing/blob/main/scripts/reconcile.ts) | Cross-check DB intent state vs `hydra-node` `/snapshot/utxo` |
| [`.github/workflows/release.yml`](https://github.com/Trivolve-Tech/Hydra-Point-of-Sale-Accept-ADA-CNTs-in-Retail-Invoicing/blob/main/.github/workflows/release.yml) | Tag-triggered GitHub Release workflow |

### On-chain context

The project ships **mainnet-ready code** that runs against **Cardano mainnet** via Blockfrost using `hydra-node` 1.3.0 and CIP-30 wallets (Vespr, Eternl, Lace, Nami, Flint, …). Because Hydra heads are **operator-instantiated** per `(merchant, customer)` pair, there is no single canonical contract address to publish — each deployment opens its own heads and the operator's wallet addresses are what hit chain. The architecture and the L1/L2 split are documented in [`docs/architecture/hybrid-custody.md`](https://github.com/Trivolve-Tech/Hydra-Point-of-Sale-Accept-ADA-CNTs-in-Retail-Invoicing/blob/main/docs/architecture/hybrid-custody.md): **L1 commits are non-custodial** (wallet-signed by the customer's CIP-30 wallet), **L2 spends are server-signed** with a per-customer ed25519 key, AES-256-GCM encrypted at rest.

### Open source status

**Yes — MIT licensed.** Single [LICENSE](https://github.com/Trivolve-Tech/Hydra-Point-of-Sale-Accept-ADA-CNTs-in-Retail-Invoicing/blob/main/LICENSE) at the repo root.

### Testing performed

- **Testnet pilot** — Hydra Head L2 payment routing with automatic L1 fallback across Cardano **Preprod + Preview** (v0.2.x line, see `CHANGELOG.md`).
- **Mainnet bring-up** — verified end-to-end via `docker compose --env-file docker/.env.mainnet -f docker/docker-compose.mainnet.yml up -d`, including the orchestrator-driven head-open path (`POST /api/heads/open`) and the customer commit path (`POST /api/heads/[id]/commit-deposit` → `POST /api/intents/[tx]/pay`).
- **Reconciliation tooling** — `scripts/reconcile.ts` cross-checks DB intent state against `hydra-node` `/snapshot/utxo`.
- **Determinism fix verified on mainnet** — `csl.FixedTransaction.sign_and_add_vkey_signature` preserves the original body bytes (re-serialising `TransactionBody` produced subtly different bytes and broke the body hash); this was caught and fixed before mainnet rollout (see `CHANGELOG.md` — Changed).
- **Live retail validation** — the Sova Bar (Da Nang) launch event drove real-customer retail payments end-to-end through the v2.0 stack.

### User feedback

The launch-event feedback artefact at [`docs/FEEDBACK.md`](https://github.com/Trivolve-Tech/Hydra-Point-of-Sale-Accept-ADA-CNTs-in-Retail-Invoicing/blob/main/docs/FEEDBACK.md) captures **four attendee testimonials** from the Sova Bar (Da Nang) launch — one from the venue partner (Apparao) and three from retail customers (Bella, Charan, Maria). Highlight: *"We love it — it is processing payments in sub-seconds. This is the best crypto PoS system I've used so far."* — **Apparao, Partner, Sova Bar**.

### Visual evidence

- **In-app product demo videos** — [docs/demo-videos/](https://github.com/Trivolve-Tech/Hydra-Point-of-Sale-Accept-ADA-CNTs-in-Retail-Invoicing/tree/main/docs/demo-videos): merchant full checkout, customer payment, Hydra L2 merchant + customer flows.
- **Community launch-event photos and videos** — [Google Drive folder](https://drive.google.com/drive/folders/1O_qfSgG00ULiqtbqYGCd4ccVhuQMg4iK?usp=drive_link) (Sova Bar, Da Nang).

---

## 2. Usage

Hydra Point-of-Sale is **live at Sova Bar (Da Nang)** for real retail payments and is **self-hostable** by any operator who wants to accept ADA and CNTs with Hydra Layer-2 settlement on Cardano mainnet.

### Who uses it and how they interact

- **Retail merchants** run `docker compose --env-file docker/.env.mainnet -f docker/docker-compose.mainnet.yml up -d` to bring up the full stack (Postgres + cardano-node + Next.js app). The merchant dashboard at `/` opens heads, creates payment intents, and watches settlement state; the customer page at `/customer` is where the payer connects their CIP-30 wallet and pays.
- **Retail customers** open the customer page on their phone, connect a Cardano wallet (Vespr, Eternl, Lace, Nami, Flint…), and pay in **ADA or CNTs**. The customer sees a **six-step commit progress stepper** with live elapsed/ETA timers and per-step status, then sub-second perceived settlement on the in-head L2 path.
- **Forks / self-hosters** clone the repo, follow [`docs/ops/mainnet-deployment.md`](https://github.com/Trivolve-Tech/Hydra-Point-of-Sale-Accept-ADA-CNTs-in-Retail-Invoicing/blob/main/docs/ops/mainnet-deployment.md), and run on their own infrastructure under MIT.

### Key actions completed

- **v1.0.0 mainnet release** published ([2026-05-24](https://github.com/Trivolve-Tech/Hydra-Point-of-Sale-Accept-ADA-CNTs-in-Retail-Invoicing/releases/tag/v1.0.0)).
- **v2.0.0 hybrid-custody mainnet rewrite** published ([2026-06-01](https://github.com/Trivolve-Tech/Hydra-Point-of-Sale-Accept-ADA-CNTs-in-Retail-Invoicing/releases/tag/v2.0.0)) — shipped with **a better retail-customer experience** (smoother CIP-30 flow, six-step progress stepper, sub-second perceived in-head L2 settlement) and **a better business experience** (single Next.js app, per-customer Hydra-head orchestration, sanitised mainnet env template, ops playbooks).
- **Sova Bar (Da Nang) live launch** — real customers paid in ADA / CNTs on Cardano mainnet, with attendee testimonials captured in [`docs/FEEDBACK.md`](https://github.com/Trivolve-Tech/Hydra-Point-of-Sale-Accept-ADA-CNTs-in-Retail-Invoicing/blob/main/docs/FEEDBACK.md).
- **Public docs site live** — GitHub Pages serving deployment, integration, and API reference content.

### Evidence of engagement

- Releases page (downloadable, installable by the public): [Releases](https://github.com/Trivolve-Tech/Hydra-Point-of-Sale-Accept-ADA-CNTs-in-Retail-Invoicing/releases).
- Docs site: [GH Pages](https://trivolve-tech.github.io/Hydra-Point-of-Sale-Accept-ADA-CNTs-in-Retail-Invoicing/).
- Launch event media: [Google Drive folder](https://drive.google.com/drive/folders/1O_qfSgG00ULiqtbqYGCd4ccVhuQMg4iK?usp=drive_link).
- Attendee testimonials: [`docs/FEEDBACK.md`](https://github.com/Trivolve-Tech/Hydra-Point-of-Sale-Accept-ADA-CNTs-in-Retail-Invoicing/blob/main/docs/FEEDBACK.md).

---

## 3. Impact

### Measurable value created (before → after)

| Dimension | Before | After this project | Source |
|---|---|---|---|
| Open-source ADA + CNT PoS using Hydra L2 on Cardano **mainnet** | Did not exist as a self-hostable product | MIT-licensed, mainnet-deployed stack with hybrid-custody design | Repo + [v2.0.0 release](https://github.com/Trivolve-Tech/Hydra-Point-of-Sale-Accept-ADA-CNTs-in-Retail-Invoicing/releases/tag/v2.0.0) |
| Retail-customer settlement latency | Card networks: seconds-to-minutes round-trip | **Sub-second perceived** in-head L2 settlement (cite Apparao's testimonial) | [docs/FEEDBACK.md](https://github.com/Trivolve-Tech/Hydra-Point-of-Sale-Accept-ADA-CNTs-in-Retail-Invoicing/blob/main/docs/FEEDBACK.md) |
| Self-custody for retail payers | Crypto cards intermediate the payment | Direct CIP-30 wallet → merchant (Charan: *"nice to use my crypto directly without cards"*) | FEEDBACK.md |
| Operator deployment cost | DIY assembly of cardano-node + hydra-node + payments stack | One-shot docker-compose with sanitised mainnet env template + ops playbooks | [docker/docker-compose.mainnet.yml](https://github.com/Trivolve-Tech/Hydra-Point-of-Sale-Accept-ADA-CNTs-in-Retail-Invoicing/blob/main/docker/docker-compose.mainnet.yml), [docs/ops](https://github.com/Trivolve-Tech/Hydra-Point-of-Sale-Accept-ADA-CNTs-in-Retail-Invoicing/tree/main/docs/ops) |
| CIP-30 wallet compatibility for Hydra L2 | Limited / not productized | Hybrid-custody architecture works with current CIP-30 wallets (which refuse to sign for L1-absent UTxOs) | [docs/architecture/hybrid-custody.md](https://github.com/Trivolve-Tech/Hydra-Point-of-Sale-Accept-ADA-CNTs-in-Retail-Invoicing/blob/main/docs/architecture/hybrid-custody.md) |

### Performance & reliability

- **Sub-second perceived L2 settlement** at the live launch event (verbatim merchant partner feedback).
- **L1 commit/close cost paid once per head**, not per payment — economical for repeat retail customers.
- **`--deposit-period` raised from 60 s to 300 s** (verified failing at 60 s on mainnet) so the snapshot leader has time to incorporate the deposit before it expires (`CHANGELOG.md` — Changed).
- **Body-hash determinism** fixed via `csl.FixedTransaction.sign_and_add_vkey_signature` so L2 signing always matches the original body bytes.
- **Reconcile script** (`scripts/reconcile.ts`) catches drift between DB intent state and `hydra-node` `/snapshot/utxo`.
- **`HPOS_KEY_SECRET` required** — the customer-profile module refuses to start without it; **no defaults** for `WALLET_SEED_PHRASE`, `BLOCKFROST_KEY`, `SITE_PASSWORD_MERCHANT`, or `HPOS_KEY_SECRET` (fail-closed).

### Cardano ecosystem benefit

- **First open-source ADA + CNT point-of-sale stack** built on Hydra L2 for **Cardano mainnet** — gives any Cardano-aligned venue a turnkey path to accept crypto natively.
- **Reusable per-head docker orchestrator** + sanitised env templates lower the operational barrier for other Cardano builders integrating Hydra heads.
- **CIP-30 wallet compatibility** advances mobile / browser-wallet Hydra adoption (the hybrid-custody design is the only model that works today against wallets that won't sign for L1-absent UTxOs).
- **Operational maturity** — published playbooks for [deployment](https://github.com/Trivolve-Tech/Hydra-Point-of-Sale-Accept-ADA-CNTs-in-Retail-Invoicing/blob/main/docs/ops/mainnet-deployment.md), [key custody](https://github.com/Trivolve-Tech/Hydra-Point-of-Sale-Accept-ADA-CNTs-in-Retail-Invoicing/blob/main/docs/ops/key-custody.md), [incidents](https://github.com/Trivolve-Tech/Hydra-Point-of-Sale-Accept-ADA-CNTs-in-Retail-Invoicing/blob/main/docs/ops/incident-playbook.md), and [`--deposit-period` tuning](https://github.com/Trivolve-Tech/Hydra-Point-of-Sale-Accept-ADA-CNTs-in-Retail-Invoicing/blob/main/docs/ops/deposit-period-tuning.md).

### Recognition

- **Sova Bar (Da Nang)** partnered to deploy the system for live retail payments.
- Four launch-event attendee testimonials captured in [`docs/FEEDBACK.md`](https://github.com/Trivolve-Tech/Hydra-Point-of-Sale-Accept-ADA-CNTs-in-Retail-Invoicing/blob/main/docs/FEEDBACK.md).

---

## 4. Sustainability

This project is **ongoing** as a maintained, public, MIT-licensed open-source codebase. The v2.0.0 hybrid-custody mainnet release is the milestone cut; the repository remains the canonical home and continues to evolve.

### Maintenance model

- **Repository**: [github.com/Trivolve-Tech/Hydra-Point-of-Sale-Accept-ADA-CNTs-in-Retail-Invoicing](https://github.com/Trivolve-Tech/Hydra-Point-of-Sale-Accept-ADA-CNTs-in-Retail-Invoicing) — issues / PRs accepted.
- **Versioning**: SemVer with a maintained [`CHANGELOG.md`](https://github.com/Trivolve-Tech/Hydra-Point-of-Sale-Accept-ADA-CNTs-in-Retail-Invoicing/blob/main/CHANGELOG.md) (Added / Changed / Removed / Security sections per release).
- **Release automation**: `.github/workflows/release.yml` builds GitHub Releases on `v*` tags.
- **Docs site**: GitHub Pages, auto-deployed (rebuilds when `docs/` changes).
- **Operational guides**: deployment, key-custody, incident-playbook, deposit-period-tuning under [`docs/ops/`](https://github.com/Trivolve-Tech/Hydra-Point-of-Sale-Accept-ADA-CNTs-in-Retail-Invoicing/tree/main/docs/ops) keep operator knowledge in-tree.

### Revenue model

The project is free and MIT-licensed — operators bear their own hosting + Blockfrost costs and pay their own Cardano L1 fees for head open/close. There is no protocol fee, no token, no central treasury attached. Ongoing maintenance, additional CNT / wallet integrations, and merchant-facing features can be pursued via follow-on Catalyst funding and/or bespoke integration engagements with merchants and Cardano-aligned venues that want a turnkey Hydra-backed PoS.

### Future roadmap

- Continued **CNT coverage** (mint-policy whitelists, configurable per-merchant accepted-token sets).
- **Multi-merchant orchestration** patterns building on the per-head template.
- **Mobile-first PWA** polish on the customer page for live-venue use.
- Continued hardening from [`docs/ops/incident-playbook.md`](https://github.com/Trivolve-Tech/Hydra-Point-of-Sale-Accept-ADA-CNTs-in-Retail-Invoicing/blob/main/docs/ops/incident-playbook.md).

### Permanent storage and forking instructions

- **Source code**: public GitHub, MIT licensed, fork-friendly.
- **Release artefacts**: attached to each tagged [GitHub Release](https://github.com/Trivolve-Tech/Hydra-Point-of-Sale-Accept-ADA-CNTs-in-Retail-Invoicing/releases) — downloadable + installable by the public.
- **Documentation**: GitHub Pages site, fully rebuildable from the cloned repo.
- **Forking instructions**: fork on GitHub, clone, follow the [README quick start](https://github.com/Trivolve-Tech/Hydra-Point-of-Sale-Accept-ADA-CNTs-in-Retail-Invoicing/blob/main/README.md#quick-start) → [`docs/ops/mainnet-deployment.md`](https://github.com/Trivolve-Tech/Hydra-Point-of-Sale-Accept-ADA-CNTs-in-Retail-Invoicing/blob/main/docs/ops/mainnet-deployment.md). Required values (Blockfrost project key, `HPOS_KEY_SECRET`, etc.) are documented inline in the sanitised `.env.mainnet.example`. No proprietary services are required to build or run the test stack.

---

## Project Completion Video (PCV)

The final community launch event was held at **Sova Bar, Da Nang**. Photos and videos from the launch are hosted on the project's shared media drive: [Community event videos and photos (Google Drive)](https://drive.google.com/drive/folders/1O_qfSgG00ULiqtbqYGCd4ccVhuQMg4iK?usp=drive_link). In-app product demo videos for the merchant + customer flows are committed in-repo under [`docs/demo-videos/`](https://github.com/Trivolve-Tech/Hydra-Point-of-Sale-Accept-ADA-CNTs-in-Retail-Invoicing/tree/main/docs/demo-videos).
