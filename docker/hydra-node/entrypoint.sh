#!/usr/bin/env bash
set -euo pipefail

KEYS_DIR="${KEYS_DIR:-/keys}"

generate_keys() {
  echo "==> Generating Hydra signing key pair..."
  hydra-node gen-hydra-key --output-file "$KEYS_DIR/hydra"
  echo "==> Generating Cardano signing key pair..."
  cardano-cli address key-gen \
    --signing-key-file "$KEYS_DIR/cardano.sk" \
    --verification-key-file "$KEYS_DIR/cardano.vk"
  echo "==> Keys written to $KEYS_DIR"
}

if [ ! -f "$KEYS_DIR/hydra.sk" ] || [ ! -f "$KEYS_DIR/cardano.sk" ]; then
  generate_keys
else
  echo "==> Using existing keys in $KEYS_DIR"
fi

exec "$@"
