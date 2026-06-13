# Launch-event Feedback

Documented feedback from the **Hydra Point-of-Sale community launch event** held at **Sova Bar, Da Nang**, where the system was rolled out for live retail payments on Cardano mainnet.

## What we shipped between v1.0.0 and v2.0.0

The launch was preceded by a follow-on **`v2.0.0`** release — the [hybrid-custody mainnet rewrite](../CHANGELOG.md#200--hybrid-custody-mainnet-rewrite) — focused on a **better retail-customer experience and a better business experience** on top of the v1.0.0 mainnet baseline.

| Audience | What changed in v2.0 |
|---|---|
| **Retail customer (payer)** | Smoother CIP-30 wallet flow (Vespr / Eternl / Lace / Nami / Flint), a clean six-step commit progress stepper with live elapsed/ETA timers and per-step status, and **sub-second perceived settlement** on the in-head Hydra L2 path. |
| **Business (merchant)** | Single Next.js app for merchant dashboard (`/`) + customer page (`/customer`), per-customer Hydra-head orchestration via docker compose, hybrid-custody model so the operator can hold the in-head L2 spend key without taking custody of L1 funds, sanitised mainnet `.env` template, and operational guides for [mainnet deployment](ops/mainnet-deployment.md), [key custody](ops/key-custody.md), and the [incident playbook](ops/incident-playbook.md). |

Full architectural background is in [`docs/architecture/hybrid-custody.md`](architecture/hybrid-custody.md); the published release is at [GitHub Releases — v2.0.0](https://github.com/Trivolve-Tech/Hydra-Point-of-Sale-Accept-ADA-CNTs-in-Retail-Invoicing/releases/tag/v2.0.0).

## Attendee testimonials

| Attendee | Role | Quote |
|---|---|---|
| **Apparao** | Partner — Sova Bar, Da Nang | "We love it — it is processing payments in sub-seconds. This is the best crypto PoS system I've used so far." |
| **Bella** | Sova customer | "I have crypto and use it through a crypto card, but this is way more fun. Love this." |
| **Charan** | Sova customer | "Nice to use my crypto directly without cards in Sova." |
| **Maria** | Sova customer | "I love Sova, and I love their new Cardano PoS." |

## Community event media

Photos and videos from the Sova Bar launch event are hosted on a shared Google Drive folder:

- [Community event videos and photos (Google Drive)](https://drive.google.com/drive/folders/1O_qfSgG00ULiqtbqYGCd4ccVhuQMg4iK?usp=drive_link)

In-app product demo videos are committed in-repo for reviewer convenience:

- [`docs/demo-videos/`](demo-videos/README.md) — merchant checkout, customer payment, Hydra L2 merchant + customer flows.

## What we took from this

- **Sub-second perceived L2 settlement was the biggest standout** for the merchant partner (Apparao). The v2.0 in-head signing path (server-signed L2 with `csl.FixedTransaction.sign_and_add_vkey_signature` to preserve body bytes) is what made that latency reliable in practice.
- **Customers don't want a card middleman** when they already hold crypto (Charan, Bella). Direct-from-wallet payments via CIP-30 were universally preferred over the existing crypto-card UX.
- **Brand-fit matters at the venue.** Maria's reaction ("I love Sova, and I love their new Cardano PoS") shows the system landed as a natural extension of the venue's identity rather than a bolted-on payment widget.

These observations are folded into the [final PCR §3 (Impact)](../PCR.md) and the project's go-forward roadmap.
