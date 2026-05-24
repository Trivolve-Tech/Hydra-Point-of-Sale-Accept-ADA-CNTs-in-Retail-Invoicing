# Hydra Point-of-Sale

Accept **ADA** and **Cardano native tokens** at retail checkout, with [Hydra Head](https://hydra.family/head-protocol/) Layer-2 settlement for sub-second confirmation and a graceful fall-back to Cardano L1.

This is the public documentation site for the open-source merchant + invoice stack at [`Trivolve-Tech/Hydra-Point-of-Sale-Accept-ADA-CNTs-in-Retail-Invoicing`](https://github.com/Trivolve-Tech/Hydra-Point-of-Sale-Accept-ADA-CNTs-in-Retail-Invoicing).

## What's in the box

| Component | Path | Role |
|---|---|---|
| **Merchant PoS** | [`merchant-pos/`](https://github.com/Trivolve-Tech/Hydra-Point-of-Sale-Accept-ADA-CNTs-in-Retail-Invoicing/tree/main/merchant-pos) | Next.js storefront: checkout UI, Hydra L2 payment intents, CIP-30 wallet bridge, status/metrics APIs |
| **Invoice backend** | [`invoice-backend/`](https://github.com/Trivolve-Tech/Hydra-Point-of-Sale-Accept-ADA-CNTs-in-Retail-Invoicing/tree/main/invoice-backend) | Node/Express invoice CRUD + PDF/Excel exports |
| **Docker compose** | [`docker/`](https://github.com/Trivolve-Tech/Hydra-Point-of-Sale-Accept-ADA-CNTs-in-Retail-Invoicing/tree/main/docker) | Cardano-node + hydra-node + invoice-backend + merchant-pos, one network at a time (preprod, preview, mainnet) |
| **E2E suite** | [`e2e-testing/`](https://github.com/Trivolve-Tech/Hydra-Point-of-Sale-Accept-ADA-CNTs-in-Retail-Invoicing/tree/main/e2e-testing) | Playwright walk-throughs of the checkout + wallet flows |

## Pick your path

| If you want to… | Go to |
|---|---|
| Run the stack locally in five minutes | [Getting Started](getting-started.md) |
| Understand how the L1 + L2 pieces fit together | [Architecture](architecture.md) |
| Run a public testnet pilot | [Deployment → Testnet](deployment-testnet.md) |
| Take a Hydra head to mainnet | [Deployment → Mainnet](deployment-mainnet.md) |
| Embed the PoS into an existing storefront | [Integration → Merchant](integration-merchant.md) |
| Build a CIP-30 wallet flow that pays into the head | [Integration → Wallet](integration-wallet.md) |
| Look up an HTTP endpoint | [API Reference](api-reference.md) |

## License

The repository and this documentation site ship under the [MIT License](https://github.com/Trivolve-Tech/Hydra-Point-of-Sale-Accept-ADA-CNTs-in-Retail-Invoicing/blob/main/LICENSE).
