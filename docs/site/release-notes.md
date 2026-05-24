# Release Notes

## v1.0.0 (mainnet release)

- Mainnet-ready Docker compose ([`docker/docker-compose.mainnet.yml`](https://github.com/Trivolve-Tech/Hydra-Point-of-Sale-Accept-ADA-CNTs-in-Retail-Invoicing/blob/main/docker/docker-compose.mainnet.yml)) plus a mainnet env template ([`docker/.env.mainnet.example`](https://github.com/Trivolve-Tech/Hydra-Point-of-Sale-Accept-ADA-CNTs-in-Retail-Invoicing/blob/main/docker/.env.mainnet.example)).
- Package versions bumped to `1.0.0` across `merchant-pos` and `invoice-backend`.
- Production hardening: the preprod-only Playwright bridge stays out of mainnet builds.
- This MkDocs site published on GitHub Pages, deployed automatically by `.github/workflows/docs.yml` on every push to `main`.
- GitHub release `v1.0.0` includes the auto-attached source archives.

## Earlier work

The repo's [commit history](https://github.com/Trivolve-Tech/Hydra-Point-of-Sale-Accept-ADA-CNTs-in-Retail-Invoicing/commits/main) and the curated [`CHANGELOG.md`](https://github.com/Trivolve-Tech/Hydra-Point-of-Sale-Accept-ADA-CNTs-in-Retail-Invoicing/blob/main/CHANGELOG.md) document the road from the requirements spec PDF through the testnet pilot to v1.0.0.

Headline pilot metrics (from the [Hydra PoS Pilot Report](https://github.com/Trivolve-Tech/Hydra-Point-of-Sale-Accept-ADA-CNTs-in-Retail-Invoicing/blob/main/docs/Hydra_PoS_Pilot_Report.md)):

- **147 payments** across Preprod + Preview
- **L2 confirmation:** 380 ms average, **126×** faster than L1
- **L2 success rate:** 94.2%; **5.8%** clean L1 fall-back
- **Merchant rating:** 4.4 / 5 across 8 respondents

