#!/usr/bin/env bash
# Fetch the public Cardano mainnet genesis bundle into hydra-config/.
# These files are NOT vendored in the repo (~1 MB Byron genesis) but the
# cardano-node service in docker-compose.mainnet.yml needs them.
#
# Source: cardano-scaling / cardano-configurations (or IOG's mirror).

set -euo pipefail

DEST=${1:-./hydra-config}
mkdir -p "$DEST"

BASE=https://raw.githubusercontent.com/input-output-hk/cardano-configurations/main/network/mainnet

for f in config.json topology.json byron-genesis.json shelley-genesis.json alonzo-genesis.json conway-genesis.json; do
  out="$DEST/$f"
  if [ -s "$out" ]; then
    echo "✓ already have $f"
    continue
  fi
  echo "↓ fetching $f"
  curl -fsSL "$BASE/cardano-node/$f" -o "$out"
done

# Rename to match what compose.mainnet.yml expects
[ -f "$DEST/config.json" ]   && mv -f "$DEST/config.json"   "$DEST/config-mainnet.json"
[ -f "$DEST/topology.json" ] && mv -f "$DEST/topology.json" "$DEST/topology-mainnet.json"

echo
echo "Done. hydra-config/ now contains:"
ls -la "$DEST"
