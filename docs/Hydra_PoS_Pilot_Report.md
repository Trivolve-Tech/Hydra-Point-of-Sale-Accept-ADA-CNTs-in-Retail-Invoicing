# Hydra Point-of-Sale — Merchant Pilot Report

**Report Date:** 2026-05-12
**Pilot Period:** 2026-04-28 to 2026-05-11
**Test Environments:** Cardano Preprod (magic=1) + Cardano Preview (magic=2)
**Prepared by:** Trivolve Tech

---

## 1. Executive Summary

This report documents the results of the Hydra Layer-2 merchant pilot conducted across two Cardano test environments (Preprod and Preview). The pilot evaluated the feasibility, performance, and merchant experience of using Hydra Head protocol for instant ADA and CNT settlement in a retail Point-of-Sale context.

During the pilot period (2026-04-28 to 2026-05-11), **147 payments** were initiated: **104 via Hydra L2** (70.7%) and **43 via Cardano L1** (29.3%). Six automatic fallback events from L2 to L1 occurred, all handled transparently without breaking the merchant checkout flow.

### Key Findings

- **L2 average confirmation time:** 380ms (vs 48.2s on L1) — a **126x speedup**
- **L2 success rate:** 94.2% of L2 payment attempts confirmed successfully
- **Fallback rate:** 5.8% of L2 attempts fell back to L1 — all recovered without merchant intervention
- **Average merchant satisfaction:** 4.4 / 5.0

---

## 2. Transaction Speed Benchmarks

The table below compares settlement performance between Hydra L2 and Cardano L1 during the pilot:

| Metric | L2 (Hydra) | L1 (On-chain) |
|---|---|---|
| Payments initiated | 104 | 43 |
| Payments confirmed | 98 | 41 |
| Avg confirmation time | **380 ms** | **48.2 s** |
| Confirmation speedup | **126x faster** | baseline |
| Success rate | 94.2% | 95.3% |

Hydra L2 delivered sub-second confirmation (avg 380ms) compared to ~48s on L1. This represents a **126x improvement** in settlement speed, transforming the checkout experience from a multi-block wait to near-instant confirmation.

---

## 3. Stability Metrics

| Metric | Value |
|---|---|
| Total Hydra connection state changes | 24 |
| Total L2 to L1 fallback events | 6 |

### Fallback Reasons

| Reason | Occurrences |
|---|---|
| Hydra head not available | 3 |
| L2 submission timed out (5s) | 2 |
| Hydra availability check failed | 1 |

All fallback events were handled automatically by the hybrid routing system. When the Hydra head became unavailable (e.g., during node restarts or network interruptions), the system seamlessly routed payments to L1 Blockfrost-based settlement. Merchants reported no disruption in their checkout flow during these events.

### Reconnection Behavior

The auto-reconnect system with exponential backoff (200ms initial, 3s cap, 2x multiplier) successfully re-established Hydra WebSocket connections after transient failures. Message deduplication via sequence tracking prevented duplicate payment processing after reconnects.

---

## 4. UX Feedback Summary

| Metric | Value |
|---|---|
| Total merchant responses | 8 |
| Average satisfaction rating | **4.4 / 5.0** |
| Participating merchants | 4 |

### Rating Distribution

| Rating | Count | |
|---|---|---|
| 5/5 | 4 | ████████████ |
| 4/5 | 3 | █████████ |
| 3/5 | 1 | ███ |
| 2/5 | 0 | |
| 1/5 | 0 | |

### Merchant Comments

> **[5/5] merchant-alpha** — "L2 confirmation was nearly instant — customers didn't even have to wait. Huge improvement over L1."

> **[4/5] merchant-beta** — "Worked well for ADA payments. Would like to see more CNT token testing in the next round."

> **[5/5] merchant-alpha** — "Fallback to L1 was seamless — I barely noticed when Hydra went down briefly."

> **[3/5] merchant-gamma** — "Initial setup was complex. Once running, the payment experience was smooth."

> **[4/5] merchant-beta** — "The settlement layer badge in the UI is helpful for distinguishing L1 vs L2."

> **[5/5] merchant-delta** — "Sub-second confirmation on L2 changes the checkout experience completely."

> **[4/5] merchant-gamma** — "Ran both preprod and preview environments. Consistent behavior across both."

> **[5/5] merchant-delta** — "The pilot report PDF generation is a nice touch for audit/compliance."

---

## 5. Test Environment Summary

| Property | Preprod | Preview |
|---|---|---|
| Network magic | 1 | 2 |
| Hydra node version | 0.20.0 | 0.20.0 |
| Docker Compose | docker-compose.preprod.yml | docker-compose.preview.yml |
| Blockfrost endpoint | cardano-preprod.blockfrost.io | cardano-preview.blockfrost.io |
| Payment tests run | 89 | 58 |
| L2 success rate | 94.6% | 93.8% |

Both environments demonstrated consistent behavior. The slightly higher test count on Preprod reflects its use as the primary development and integration testing environment.

---

## 6. Architecture Summary

The Hydra PoS integration consists of the following components:

- **TypeScript Hydra Client SDK** — WebSocket + REST client ported from the hydra-mobile-sdk Dart library, with auto-reconnect, message parsing, and sequence deduplication.
- **Hybrid Payment Router** — Checks Hydra head state on each payment creation; routes to L2 if Open and connected, L1 otherwise.
- **PayWithHydraButton (React)** — CIP-30 wallet signing with CBOR submission to Hydra `/transaction` endpoint instead of L1 broadcast.
- **Metrics Collector** — Records payment creation, confirmation times, fallback events, and connection state changes to a persistent JSON store.
- **Pilot Report Generator** — Markdown-based report builder that aggregates metrics and merchant feedback into a structured document.
- **Docker Infrastructure** — Containerized stacks for cardano-node + hydra-node + merchant-pos + invoice-backend on Preprod and Preview networks.

---

## 7. Recommendations for Production Rollout

### Proceed to Production

The pilot data supports proceeding to mainnet deployment. L2 confirmation speed, fallback reliability, and merchant satisfaction all meet or exceed the acceptance criteria.

### Operational Recommendations

- Deploy automated health checks on `/api/hydra/status` with alerting on availability drops.
- Set fallback frequency alerting threshold at 5% of L2 attempts.
- Consider deploying multiple Hydra heads for high-traffic merchants to increase throughput.
- Implement persistent connection monitoring dashboards (Grafana or similar).
- Schedule periodic head rebalancing (close + fanout + re-open) during low-traffic windows.
- Extend CNT token testing with a broader set of policy IDs before mainnet token support.
- Collect ongoing merchant feedback post-launch to identify UX refinements.
- Document runbooks for Hydra head recovery scenarios (contested close, failed fanout).

---

*Hydra PoS Pilot Report — Trivolve Tech*
*Generated: 2026-05-12*
