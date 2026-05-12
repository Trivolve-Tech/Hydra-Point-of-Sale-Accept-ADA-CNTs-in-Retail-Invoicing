# Hydra Testnet Demo Guide

Public testnet demonstration of Hydra L2 payments in the Cardano Point-of-Sale system.

## Prerequisites

- Docker + Docker Compose
- A Blockfrost account with preprod and/or preview project IDs
- A funded Cardano testnet wallet (mnemonic seed phrase)
- Hydra signing keys (generated automatically on first run)

## Quick Start (Preprod)

```bash
# 1. Copy environment template
cp docker/.env.preprod.example docker/.env.preprod

# 2. Edit docker/.env.preprod with your Blockfrost keys and wallet mnemonic
nano docker/.env.preprod

# 3. Launch the full stack
docker compose -f docker/docker-compose.preprod.yml up -d

# 4. Wait for cardano-node to sync (check logs)
docker compose -f docker/docker-compose.preprod.yml logs -f cardano-node

# 5. Open the merchant PoS
open http://localhost:3000
```

## Quick Start (Preview)

```bash
cp docker/.env.preview.example docker/.env.preview
nano docker/.env.preview
docker compose -f docker/docker-compose.preview.yml up -d
```

## Key Generation

On first launch, the hydra-node entrypoint generates signing keys automatically:

```bash
# Manual key generation (if needed)
docker run --rm -v $(pwd)/docker/hydra-node/keys:/keys \
  ghcr.io/cardano-scaling/hydra-node:0.20.0 \
  gen-hydra-key --output-file /keys/hydra
```

For the Cardano signing key:
```bash
cardano-cli address key-gen \
  --signing-key-file docker/hydra-node/keys/cardano.sk \
  --verification-key-file docker/hydra-node/keys/cardano.vk
```

## Local Development (Without Docker)

```bash
# Terminal 1: Invoice backend
cd invoice-backend && npm install && node ./src/index.js

# Terminal 2: Merchant PoS with Hydra enabled
cd merchant-pos
cp .env.example .env
# Edit .env — set HYDRA_ENABLE=true, HYDRA_NODE_HOST, HYDRA_NODE_PORT, etc.
pnpm install && pnpm dev
```

Or use the all-in-one stack command:
```bash
cd merchant-pos && pnpm dev:stack
```

## Demo Walkthrough

### 1. Check Hydra Status

```bash
curl http://localhost:3000/api/hydra/status | jq
```

Expected response when Hydra head is open:
```json
{
  "available": true,
  "headState": "Open",
  "headId": "...",
  "connectionState": "connected"
}
```

When Hydra is disabled or unavailable:
```json
{
  "available": false,
  "headState": "Disabled",
  "connectionState": "disconnected"
}
```

### 2. Create an L2 Payment

```bash
curl -X POST http://localhost:3000/api/payment \
  -H 'Content-Type: application/json' \
  -d '{"amount": 5, "prefer_hydra": true}' | jq
```

Response includes `settlement_layer`:
```json
{
  "tx_id": "...",
  "amount": 5,
  "payment_address": "addr_test1...",
  "settlement_layer": "L2",
  "hydra_status": "pending",
  "created_at": "2026-05-12T..."
}
```

### 3. Create an L1 Payment (Fallback)

```bash
curl -X POST http://localhost:3000/api/payment \
  -H 'Content-Type: application/json' \
  -d '{"amount": 3, "prefer_hydra": false}' | jq
```

### 4. Submit L2 Transaction

After the customer signs a transaction via CIP-30 wallet:

```bash
curl -X POST http://localhost:3000/api/hydra/submit \
  -H 'Content-Type: application/json' \
  -d '{"tx_id": "<payment-tx-id>", "cbor_hex": "<signed-tx-cbor>"}' | jq
```

### 5. Check Payment Status

```bash
curl "http://localhost:3000/api/payment?tx=<tx_id>" | jq
```

### 6. View Metrics

```bash
curl http://localhost:3000/api/hydra/metrics | jq
```

### 7. Submit Pilot Feedback

```bash
curl -X POST http://localhost:3000/api/hydra/feedback \
  -H 'Content-Type: application/json' \
  -d '{"rating": 5, "comments": "L2 settlement was instant, great UX"}' | jq
```

### 8. Generate Pilot Report PDF

```bash
curl http://localhost:3000/api/hydra/pilot-report.pdf -o pilot-report.pdf
open pilot-report.pdf
```

## L1 Fallback Scenarios

The system automatically falls back to L1 when:

1. **Hydra disabled** (`HYDRA_ENABLE=false`) — all payments route to L1
2. **Hydra node unreachable** — connection fails, payment created as L1
3. **Head not Open** — head state is Idle/Closed/etc., routes to L1
4. **L2 submission fails** — TxInvalid or timeout, record updated to `hydra_status: "failed"`, L1 polling continues via Blockfrost

To test fallback:
```bash
# Stop hydra-node while app is running
docker compose -f docker/docker-compose.preprod.yml stop hydra-node

# Create a payment — should fall back to L1
curl -X POST http://localhost:3000/api/payment \
  -H 'Content-Type: application/json' \
  -d '{"amount": 2, "prefer_hydra": true}' | jq
# → settlement_layer: "L1", l1_fallback_reason: "Hydra head not available"

# Restart hydra-node
docker compose -f docker/docker-compose.preprod.yml start hydra-node
```

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `HYDRA_ENABLE` | No | `false` | Enable Hydra L2 subsystem |
| `HYDRA_NODE_HOST` | If enabled | — | Hydra node hostname |
| `HYDRA_NODE_PORT` | No | `4001` | Hydra node API port |
| `HYDRA_NODE_SECURE` | No | `false` | Use WSS/HTTPS |
| `NEXT_PUBLIC_HYDRA_ENABLED` | No | `false` | Show L2 UI elements |
| `BLOCKFROST_KEY` | Yes | — | Server-side Blockfrost key |
| `WALLET_SEED_PHRASE` | Yes | — | HD wallet mnemonic |

## Two Test Environments

| Environment | Network | Testnet Magic | Docker Compose |
|-------------|---------|---------------|----------------|
| Preprod | `preprod` | 1 | `docker/docker-compose.preprod.yml` |
| Preview | `preview` | 2 | `docker/docker-compose.preview.yml` |

Both environments run identical stacks with different chain configs and Blockfrost endpoints.

## Monitoring

- **Hydra status**: `GET /api/hydra/status`
- **Metrics**: `GET /api/hydra/metrics`
- **Feedback**: `GET /api/hydra/feedback`
- **Pilot report**: `GET /api/hydra/pilot-report.pdf`
