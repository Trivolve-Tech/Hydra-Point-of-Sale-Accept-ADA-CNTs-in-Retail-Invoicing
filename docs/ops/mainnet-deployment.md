# Mainnet Deployment Runbook

Audience: operator launching the v1 controlled pilot on Cardano mainnet. **Read this top-to-bottom before touching the mainnet stack.**

The pilot is fully custodial in v1 — merchant infra holds both customer keys per head (`docs/ops/non-custody-spike.md`). Cap per-customer float (~$200) and brief enrolled customers on the trust assumption.

## 1. Host prerequisites

- Linux host with Docker 24+ and Docker Compose v2.
- ≥ 100 GB disk for the mainnet cardano-node + Postgres + hydra-node data (grows with #heads).
- Inbound ports: 80, 443 (Caddy). Hydra peer-to-peer ports (5100–5500 by default) need to be reachable by participating customer nodes; restrict via firewall to known peer IPs when possible.
- Run pos as a dedicated non-root user; this user owns `infra/hydra/keys/`.
- The host running `pos` needs access to the Docker socket so the orchestrator can `docker compose up/down` per-head stacks.

## 2. Repo + .env

```sh
git clone <repo> /opt/hydra-pos-mainnet
cd /opt/hydra-pos-mainnet
cp pos/.env.example pos/.env.mainnet
```

Required env vars in `pos/.env.mainnet`:

| Var | Value |
|---|---|
| `DATABASE_URL` | `postgres://hydra_pos:<strong-password>@localhost:5432/hydra_pos` |
| `CARDANO_NETWORK` | `mainnet` |
| `NEXT_PUBLIC_CARDANO_NETWORK` | `mainnet` |
| `HYDRA_SCRIPTS_TX_ID` | Mainnet Hydra scripts tx id from `hydra-node/networks.json` for v1.3.0 |
| `HYDRA_NODE_HOST` | `localhost` (orchestrator routes per-head via ports) |
| `WALLET_SEED_PHRASE` | Operator BIP39 seed — **HSM/KMS recommended; do not commit** |

## 3. Generate operator wallet + fund it

The operator wallet pays L1 fees for per-head Init/Close/Fanout. Estimate ~5–10 ADA float per head over its lifetime. For a 5-customer pilot, fund the operator address with ≥ 100 ADA.

## 4. Sync mainnet cardano-node

```sh
docker compose -f infra/docker/compose.mainnet.yml up -d cardano-node
docker compose -f infra/docker/compose.mainnet.yml logs -f cardano-node
```

Mainnet sync from genesis takes **multiple hours to days** on a fresh host. Wait until the node reports `slot 0% behind tip` before proceeding.

## 5. Start Postgres + run migrations

```sh
docker compose -f infra/docker/compose.mainnet.yml up -d postgres
cd pos && pnpm install --frozen-lockfile && pnpm db:migrate
```

## 6. Start `pos` behind Caddy

```sh
cd pos && pnpm build && pnpm start &   # or run under systemd
docker run -d --name caddy \
  --network hydra-pos-mainnet \
  -p 80:80 -p 443:443 \
  -v $PWD/infra/docker/caddy/Caddyfile:/etc/caddy/Caddyfile:ro \
  -v caddy-data:/data -v caddy-config:/config \
  -e POS_DOMAIN=pos.your-shop.example -e ACME_EMAIL=ops@your-shop.example \
  caddy:2-alpine
```

Visit `https://pos.your-shop.example/api/health` — should return `{"status":"ok"}`.

## 7. Validate on mainnet *without taking customer funds*

1. Enroll your own test wallet via `POST /api/customers/enroll`. The orchestrator opens a new head and spawns its hydra-node pair.
2. Check `GET /api/heads/<id>/state` — Hydra should report `Initial` and progress to `Open` once both parties post their Commit transactions.
3. Commit a small amount (~5 ADA) via `POST /api/heads/<id>/commit`, sign the returned draft tx, submit to L1.
4. Send one in-head payment via `PayWithHydraButton` — expect `TxValid` within ~5 s.
5. Decommit the remainder via `POST /api/heads/<id>/decommit`.
6. Close the head via `POST /api/heads/<id>/close`. **Funds settle to L1 after the 12-hour contestation period** — plan accordingly.
7. Reconcile with `pnpm reconcile`; expect zero drift.

Only once this dry-run is clean for at least 24 h do you onboard real customers.

## 8. Onboard pilot customers

- Each customer enrolls via the /enroll page. The orchestrator opens their head.
- Cap initial deposits to ~$200 worth of ADA per customer.
- Document the trust assumption to each customer in writing: "Your in-head balance during the v1 pilot is held under merchant operational control. Strict non-custody is a v2 commitment."
- Daily: run `pnpm reconcile` and check the output. Investigate any drift before opening more heads.

## 9. Ongoing operations

- Monitor head state hourly: `GET /api/heads/<id>/state` for each open head.
- Watch cardano-node + hydra-node logs for `NodeUnsynced`, `RejectedInputBecauseUnsynced`.
- Back up Postgres daily (`pg_dump`).
- See `incident-playbook.md` for failure modes.
