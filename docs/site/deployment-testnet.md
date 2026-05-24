# Deployment — Testnet (Preprod / Preview)

The fastest fully-on-chain way to exercise the stack. Funds flow through real Cardano testnet ADA and tNIGHT, so you can also drive the Hydra head end-to-end.

## Prerequisites

- Docker + Docker Compose.
- A [Blockfrost](https://blockfrost.io) account with a **preprod** or **preview** project id.
- A funded Cardano testnet wallet (24-word mnemonic). Top up via [the official Cardano testnet faucet](https://docs.cardano.org/cardano-testnets/tools/faucet/).

## Quick start — Preprod

```bash
cp docker/.env.preprod.example docker/.env.preprod
# edit docker/.env.preprod
#   BLOCKFROST_KEY=preprodXXXX
#   WALLET_SEED_PHRASE='twenty four words …'

docker compose -f docker/docker-compose.preprod.yml up -d
docker compose -f docker/docker-compose.preprod.yml logs -f cardano-node  # wait for sync

open http://localhost:3000
```

## Quick start — Preview

Same shape, swap one file:

```bash
cp docker/.env.preview.example docker/.env.preview
docker compose -f docker/docker-compose.preview.yml up -d
```

## Key generation

The first time `hydra-node` boots it generates signing keys into `docker/hydra-node/keys/`. To regenerate manually:

```bash
# Hydra signing key
docker run --rm -v "$(pwd)/docker/hydra-node/keys:/keys" \
  ghcr.io/cardano-scaling/hydra-node:0.20.0 \
  gen-hydra-key --output-file /keys/hydra

# Cardano signing key (uses cardano-cli)
cardano-cli address key-gen \
  --signing-key-file docker/hydra-node/keys/cardano.sk \
  --verification-key-file docker/hydra-node/keys/cardano.vk
```

## Smoke test (8 curls)

### 1. Hydra status

```bash
curl http://localhost:3000/api/hydra/status | jq
# { "available": true, "headState": "Open", "headId": "…", "connectionState": "connected" }
```

### 2. Create an L2 payment

```bash
curl -X POST http://localhost:3000/api/payment \
  -H 'Content-Type: application/json' \
  -d '{"amount": 5, "prefer_hydra": true}' | jq
```

### 3. Create an L1 payment (force fallback)

```bash
curl -X POST http://localhost:3000/api/payment \
  -H 'Content-Type: application/json' \
  -d '{"amount": 3, "prefer_hydra": false}' | jq
```

### 4. Submit an L2 transaction

After the customer signs via CIP-30:

```bash
curl -X POST http://localhost:3000/api/hydra/submit \
  -H 'Content-Type: application/json' \
  -d '{"tx_id":"<payment-tx-id>","cbor_hex":"<signed-cbor>"}' | jq
```

### 5. Check payment status

```bash
curl "http://localhost:3000/api/payment?tx=<tx_id>" | jq
```

### 6. Read metrics

```bash
curl http://localhost:3000/api/hydra/metrics | jq
```

### 7. Submit pilot feedback

```bash
curl -X POST http://localhost:3000/api/hydra/feedback \
  -H 'Content-Type: application/json' \
  -d '{"rating":5,"comments":"L2 settlement was instant, great UX"}'
```

### 8. Generate pilot-report PDF

```bash
curl http://localhost:3000/api/hydra/pilot-report.pdf -o pilot-report.pdf
```

## L1 fallback test

```bash
# Stop hydra-node mid-flight
docker compose -f docker/docker-compose.preprod.yml stop hydra-node

# Create a payment — should fall back to L1
curl -X POST http://localhost:3000/api/payment \
  -H 'Content-Type: application/json' \
  -d '{"amount": 2, "prefer_hydra": true}' | jq
# → "settlement_layer": "L1", "l1_fallback_reason": "Hydra head not available"

docker compose -f docker/docker-compose.preprod.yml start hydra-node
```

## Environment variables (testnet)

| Variable | Required | Default | Notes |
|---|---|---|---|
| `HYDRA_ENABLE` | no | `false` | Enable the L2 path |
| `HYDRA_NODE_HOST` | when enabled | — | Container hostname inside compose |
| `HYDRA_NODE_PORT` | no | `4001` | hydra-node API port |
| `HYDRA_NODE_SECURE` | no | `false` | Use WSS/HTTPS |
| `NEXT_PUBLIC_HYDRA_ENABLED` | no | `false` | Show L2 affordances in the UI |
| `BLOCKFROST_KEY` | yes | — | Server-side Blockfrost project id |
| `WALLET_SEED_PHRASE` | yes | — | 24-word mnemonic; never commit |
| `CARDANO_NETWORK` | yes | `preprod` | `preprod` or `preview` here |

## Next step

When the testnet pilot is happy, jump to [Deployment → Mainnet](deployment-mainnet.md). The differences are listed in the diff against `docker-compose.mainnet.yml`.
