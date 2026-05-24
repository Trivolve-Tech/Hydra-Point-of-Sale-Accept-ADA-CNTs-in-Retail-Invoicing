# Getting Started

The fastest path to a working merchant checkout against Cardano Preprod with Hydra L2 enabled.

## Prerequisites

| Tool | Version | Why |
|---|---|---|
| Node | 20.x | merchant-pos + invoice-backend runtime |
| pnpm | 9.x or npm 10.x | merchant-pos package manager (npm works too) |
| Docker + Docker Compose | latest | hydra-node + cardano-node containers |
| Blockfrost account | Free tier OK | preprod / preview / mainnet project id |
| Cardano wallet seed (24 words) | testnet wallet | funds the L1 commits + head |

## Three-command quick start (Preprod)

```bash
git clone https://github.com/Trivolve-Tech/Hydra-Point-of-Sale-Accept-ADA-CNTs-in-Retail-Invoicing.git
cd Hydra-Point-of-Sale-Accept-ADA-CNTs-in-Retail-Invoicing

# 1. Populate environment
cp docker/.env.preprod.example docker/.env.preprod
# edit docker/.env.preprod: BLOCKFROST_KEY, WALLET_SEED_PHRASE

# 2. Bring the stack up
docker compose -f docker/docker-compose.preprod.yml up -d

# 3. Open the merchant PoS
xdg-open http://localhost:3000   # or open http://localhost:3000 on macOS
```

While the cardano-node syncs (10–30 minutes on first boot, depending on bandwidth), the merchant-pos shell still loads — `Hydra: pending` until the head is open.

## Without Docker (developer loop)

```bash
# Terminal 1: invoice backend
cd invoice-backend
npm install
node ./src/index.js     # listens on :7071

# Terminal 2: merchant-pos
cd merchant-pos
cp .env.example .env
# edit .env: BLOCKFROST_KEY, WALLET_SEED_PHRASE, INVOICE_BACKEND_URL=http://localhost:7071
pnpm install
pnpm dev                # http://localhost:3000
```

Or the convenience target that runs both in one shell:

```bash
cd merchant-pos
pnpm dev:stack
```

## What to do next

- Configure Hydra ↔ Cardano keys: [Deployment → Testnet](deployment-testnet.md#key-generation)
- Walk through a Hydra L2 payment from the customer side: [Integration → Wallet](integration-wallet.md)
- Promote the same stack to mainnet: [Deployment → Mainnet](deployment-mainnet.md)
