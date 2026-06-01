#!/usr/bin/env node
/* eslint-disable */
const fs = require("fs");
const path = require("path");
const bip39 = require("bip39");
const CSL = require("@emurgo/cardano-serialization-lib-nodejs");

function harden(n) { return 0x80000000 + n; }

function deriveMainnetEnterpriseAddr(mnemonic, idx = 0) {
  const entropy = bip39.mnemonicToEntropy(mnemonic);
  const rootKey = CSL.Bip32PrivateKey.from_bip39_entropy(
    Buffer.from(entropy, "hex"),
    Buffer.from("")
  );
  const acct = rootKey.derive(harden(1852)).derive(harden(1815)).derive(harden(0));
  const utxoPub = acct.derive(0).derive(idx).to_public();
  const networkId = CSL.NetworkInfo.mainnet().network_id();
  const enterprise = CSL.EnterpriseAddress.new(
    networkId,
    CSL.Credential.from_keyhash(utxoPub.to_raw_key().hash())
  );
  return enterprise.to_address().to_bech32();
}

function writeSeed(filepath, mnemonic) {
  fs.writeFileSync(filepath, mnemonic + "\n", { mode: 0o600 });
  fs.chmodSync(filepath, 0o600);
}

function makeWallet(label, outPath) {
  const m = bip39.generateMnemonic(256); // 24 words
  writeSeed(outPath, m);
  const addr = deriveMainnetEnterpriseAddr(m, 0);
  console.log(`[${label}] seed file:   ${outPath}`);
  console.log(`[${label}] receive (idx 0): ${addr}`);
  console.log("");
  return { mnemonic: m, address: addr };
}

// Where to write the seeds. Override via SECRETS_DIR env var; the script
// will create the directory if it doesn't exist. Seeds are written with
// mode 0600 — don't keep them on a multi-tenant host.
const SECRETS = process.env.SECRETS_DIR ?? path.join(process.env.HOME ?? ".", ".hpos-secrets");
fs.mkdirSync(SECRETS, { recursive: true, mode: 0o700 });

const M_PATH = path.join(SECRETS, "merchant.seed");
const C_PATH = path.join(SECRETS, "customer.seed");

const merchant = makeWallet("MERCHANT", M_PATH);
const customer = makeWallet("CUSTOMER", C_PATH);

// also emit a machine-readable summary
fs.writeFileSync(
  path.join(SECRETS, "wallets.json"),
  JSON.stringify(
    {
      merchant: { seedFile: M_PATH, receiveIdx0: merchant.address },
      customer: { seedFile: C_PATH, receiveIdx0: customer.address },
      createdAt: new Date().toISOString(),
      network: "mainnet",
    },
    null,
    2
  ),
  { mode: 0o600 }
);
console.log(`[summary] ${path.join(SECRETS, "wallets.json")} (addresses only)`);
