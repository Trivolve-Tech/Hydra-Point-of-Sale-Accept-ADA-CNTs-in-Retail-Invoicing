/**
 * Derive the enterprise addresses for the first N HD indices from the
 * operator MNEMONIC at <env-file>. These are the addresses hydra-node
 * will look at for L1 fee funds when opening per-customer heads (head N uses
 * payment key at m/1852'/1815'/0'/0/N). Pre-fund each before opening that head.
 */
import { readFileSync } from "fs";
import { mnemonicToEntropy } from "bip39";
import * as csl from "@emurgo/cardano-serialization-lib-nodejs";

const ENV_PATH = process.argv[2] ?? process.env.HPOS_ENV_FILE;
if (!ENV_PATH) {
  console.error("usage: tsx derive-merchant-addresses.ts <path-to-env-with-MNEMONIC>");
  console.error("  or set HPOS_ENV_FILE=<path>");
  process.exit(2);
}
const N = 5;

const env = readFileSync(ENV_PATH, "utf8");
const m = env.match(/^\s*(?:export\s+)?MNEMONIC\s*=\s*"?([^"\n#]+?)"?\s*(?:#.*)?$/m);
if (!m) {
  console.error("MNEMONIC not found");
  process.exit(1);
}
const phrase = m[1]!.trim();
const entropy = mnemonicToEntropy(phrase);
const root = csl.Bip32PrivateKey.from_bip39_entropy(
  Buffer.from(entropy, "hex"),
  Buffer.from(""),
);

const harden = (n: number) => n + 0x80000000;
const account = root.derive(harden(1852)).derive(harden(1815)).derive(harden(0));
const networkId = csl.NetworkInfo.mainnet().network_id();

console.log("Pre-fund these enterprise addresses (~5 ADA each) before opening each head:");
console.log("=".repeat(110));
for (let i = 0; i < N; i++) {
  for (const accountIdx of [0, 1]) {
    const acct = root.derive(harden(1852)).derive(harden(1815)).derive(harden(accountIdx));
    const paymentVk = acct.derive(0).derive(i).to_public();
    const paymentCred = csl.Credential.from_keyhash(paymentVk.to_raw_key().hash());
    const enterprise = csl.EnterpriseAddress.new(networkId, paymentCred).to_address().to_bech32();
    const role = accountIdx === 0 ? "merchant" : "customer";
    console.log(`head ${i}  ${role.padEnd(8)}  ${enterprise}`);
  }
}
