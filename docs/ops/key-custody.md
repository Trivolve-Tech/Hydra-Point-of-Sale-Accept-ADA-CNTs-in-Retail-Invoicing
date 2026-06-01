# Key Custody (v1 Pilot)

This document specifies how cryptographic keys are generated, stored, used, and rotated in the v1 fully-custodial pilot. v2 (strict non-custody) is documented in [`non-custody-spike.md`](./non-custody-spike.md).

## Key inventory

| Key | Owned by | Storage | Purpose |
|---|---|---|---|
| **Operator BIP39 seed** | merchant operator | `WALLET_SEED_PHRASE` env var (HSM/KMS for production) | Funds L1 fees for Init / Close / Fanout. Optionally derives per-head merchant keys (future). |
| **Per-head merchant `hydra-sk`** | merchant operator | `infra/hydra/keys/<head_id>/merchant-hydra.sk` (chmod 600) | Signs merchant snapshots inside the head and authenticates merchant network messages. |
| **Per-head merchant `cardano-sk`** | merchant operator | `infra/hydra/keys/<head_id>/merchant-cardano.sk` (chmod 600) | Signs merchant's L1 commits / decommits / close / contest / fanout for this head. |
| **Per-head customer `hydra-sk`** | merchant operator (v1) | `infra/hydra/keys/<head_id>/customer-hydra.sk` (chmod 600) | Same as merchant `hydra-sk` but for the customer party. v2: moves client-side. |
| **Per-head customer `cardano-sk`** | merchant operator (v1) | `infra/hydra/keys/<head_id>/customer-cardano.sk` (chmod 600) | Same as merchant `cardano-sk` but for the customer party. v2: moves to customer's CIP-30 wallet. |

## Why both customer keys are server-side in v1

The Phase B spike found that hydra-node 1.3.0 reads `--hydra-signing-key` from disk and has no native external-signer mechanism. The signing key is also used by the network-auth layer, so the customer-side hydra-node *must* possess the customer's `hydra-sk` locally to participate at all. Holding the customer's `cardano-sk` alongside it lets the orchestrator drive the full lifecycle (Init / Commit / Close / Fanout) without requiring synchronous customer involvement. Together this is full operational custody.

The v2 plan reverses this: the customer's `hydra-sk` lives in tmpfs on a per-head basis with browser-side multisig verification of `ConfirmedSnapshot`s, plus a CIP-30 guard on the L1 close tx. See `non-custody-spike.md` §"Recommendation".

## Filesystem layout

```
infra/hydra/keys/
├── <head_id_1>/
│   ├── merchant-hydra.sk    # chmod 600
│   ├── merchant-hydra.vk    # chmod 644
│   ├── merchant-cardano.sk  # chmod 600
│   ├── merchant-cardano.vk  # chmod 644
│   ├── customer-hydra.sk    # chmod 600
│   ├── customer-hydra.vk    # chmod 644
│   ├── customer-cardano.sk  # chmod 600
│   └── customer-cardano.vk  # chmod 644
└── <head_id_2>/...
```

The directory itself is `chmod 700`. Owner: the `pos` runtime user. Group: no group access.

## Generation

The orchestrator (`pos/src/server/orchestrator/keys.ts`) generates fresh Ed25519 keypairs at enrollment time. Hydra keys come from `@noble/ed25519.utils.randomPrivateKey()`; Cardano keys come from `csl.PrivateKey.generate_ed25519()`. Both are serialised to the Cardano TextEnvelope JSON format (`cborHex: 5820<32-byte hex>`).

## Rotation

- **Per-head keys**: not rotated during the head's lifetime. The whole head is closed and a new one opened — closing+reopening costs ~4 L1 transactions and a 12-h contestation, so this is a forced rotation, not routine.
- **Operator BIP39 seed**: rotate once a year or on incident. Procedure in `incident-playbook.md` §B.

## Backups

- **Per-head keys**: not backed up. They are short-lived (one head's lifetime). If the merchant infra loses these before close + fanout, the head's funds are recoverable only via the contestation/fanout mechanism using whatever snapshots are still observable on-chain — i.e. the customer may lose their last few in-head transactions. Mitigation: snapshot the `infra/hydra/keys/` directory to a separate volume daily; restore on host loss.
- **Operator BIP39 seed**: must be backed up offline (paper, hardware wallet, HSM) before mainnet rollout. Without it, no new heads can be opened.

## Production hardening (post-pilot)

- Move `WALLET_SEED_PHRASE` to AWS KMS / GCP Cloud KMS / HashiCorp Vault. Have pos read it via the cloud SDK on startup, not from `.env`.
- Run pos under a dedicated systemd unit with `ProtectHome=`, `ProtectSystem=strict`, `ReadWritePaths=` scoped to `infra/hydra/keys/`.
- Audit `infra/hydra/keys/` access with auditd; alert on any non-`pos` user reading the SK files.
- Implement the v2 plan from `non-custody-spike.md`.
