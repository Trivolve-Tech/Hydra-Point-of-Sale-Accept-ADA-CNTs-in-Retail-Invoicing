# Deployment — Mainnet

!!! warning "Real ADA on mainnet"
    This compose file settles real value on Cardano mainnet. Hydra Head on mainnet is still tagged **experimental** by Input Output (see the [Hydra docs](https://hydra.family/head-protocol/docs/getting-started)). Treat the operator wallet seed as production-grade and follow the hardening checklist at the bottom of this page before exposing the stack publicly.

## Prerequisites

- Docker + Docker Compose.
- A **mainnet** [Blockfrost](https://blockfrost.io) project id.
- A **dedicated mainnet wallet** with only the float you intend to lock into the Hydra head. Use a hardware-signer-backed flow or a vaulted seed; never store the seed in plain text on disk.
- Fresh Hydra signing keys generated specifically for this deployment (never reuse testnet keys).

## Quick start

```bash
cp docker/.env.mainnet.example docker/.env.mainnet
# edit docker/.env.mainnet
#   BLOCKFROST_KEY=mainnetXXXX
#   WALLET_SEED_PHRASE='twenty four words …'
#   CARDANO_NETWORK=mainnet
#   NEXT_PUBLIC_BLOCKFROST_PROJECT_ID=mainnetXXXX
#   NEXT_PUBLIC_CARDANO_NETWORK=mainnet

docker compose -f docker/docker-compose.mainnet.yml up -d
docker compose -f docker/docker-compose.mainnet.yml logs -f cardano-node  # full sync ≈ a few hours
```

Once the cardano-node reports `tip` at the chain head, `merchant-pos` will show `Hydra: pending` until the head is open.

## Key generation (mainnet)

Generate fresh keys into `docker/hydra-node/keys/` before the first start. **Do not** copy testnet keys.

```bash
# Hydra signing key
docker run --rm -v "$(pwd)/docker/hydra-node/keys:/keys" \
  ghcr.io/cardano-scaling/hydra-node:0.20.0 \
  gen-hydra-key --output-file /keys/hydra

# Cardano signing key (mainnet)
cardano-cli address key-gen \
  --signing-key-file docker/hydra-node/keys/cardano.sk \
  --verification-key-file docker/hydra-node/keys/cardano.vk
```

Fund the address derived from `cardano.vk` with enough ADA to (a) cover the L1 transaction fees for the open / commit / fanout cycle and (b) hold the float you intend to commit into the head.

## Differences vs the testnet compose

```bash
diff docker/docker-compose.preprod.yml docker/docker-compose.mainnet.yml
```

The substantive deltas:

- `NETWORK: preprod` → `NETWORK: mainnet`
- `--testnet-magic 1` is removed; mainnet has no magic.
- Volume names rename from `cardano-data-preprod` / `hydra-data-preprod` to `…-mainnet` so the mainnet chain DB never collides with a testnet one.
- The merchant-pos service block sets `CARDANO_NETWORK=mainnet` and `NEXT_PUBLIC_CARDANO_NETWORK=mainnet`.

## Hardening checklist

Run through this before pointing real customer traffic at the deployment.

- [ ] **`docker/.env.mainnet` lives outside the repo** (symlink it in from a secret manager, or use `--env-file` with a path under `/etc/`).
- [ ] **`WALLET_SEED_PHRASE` is not in environment files on the host** — inject it at runtime via Docker secrets, Vault, or AWS Secrets Manager.
- [ ] **No test-only routes**: production builds do not include the preprod-only Playwright bridge; confirm none of `e2e-testing/` is mounted into the container.
- [ ] **TLS reverse proxy** in front of merchant-pos (Caddy, nginx, or your CDN's terminator). Do not expose `:3000` directly.
- [ ] **Restrict the hydra-node API port** (`:4001`) to `localhost` or the docker network only; the API is unauthenticated.
- [ ] **Rotate the Blockfrost mainnet key** if it has ever been logged or screenshotted.
- [ ] **Backup the Hydra signing key** to an offline medium; losing it forfeits the head's funds.
- [ ] **Monitor** the merchant-pos logs and the `hydra-node` WebSocket for `HeadIsAborted` / `HeadIsClosed` events; subscribe a pager.

## Operational notes

- **Head closure**: when the merchant closes the day, run the `Close` redeemer via the hydra-node API; after the contestation period, `Fanout` returns the head balance to L1.
- **Backups**: snapshot `docker/hydra-node/keys/` and the `hydra-data-mainnet` Docker volume before any upgrade.
- **Upgrades**: pin the `hydra-node:0.20.0` image tag in `docker-compose.mainnet.yml`. Test new versions on `docker-compose.preprod.yml` first and only bump mainnet after a successful pilot.

## Where to go next

- [Integration — Merchant](integration-merchant.md) for embedding the PoS into an existing storefront.
- [Integration — Wallet](integration-wallet.md) for the customer-side flow.
- [API Reference](api-reference.md) for the exact request/response shapes.
