import { mkdir, writeFile, chmod } from "fs/promises";
import { join } from "path";
import { createHash } from "node:crypto";
import * as ed25519 from "@noble/ed25519";
import * as csl from "@emurgo/cardano-serialization-lib-nodejs";
import { mnemonicToEntropy } from "bip39";

// @noble/ed25519 v2+ needs a sync SHA512 hash function set explicitly.
// Use Node's built-in crypto to avoid adding @noble/hashes as a dep.
ed25519.etc.sha512Sync = (...messages: Uint8Array[]) => {
  const h = createHash("sha512");
  for (const m of messages) h.update(Buffer.from(m));
  return new Uint8Array(h.digest());
};

// v1 (fully custodial). Two derivation strategies per head:
//
//   merchant.cardano  — HD-derived from the operator MNEMONIC at
//                       m/1852'/1815'/0'/0/<headIndex>, so the address is
//                       deterministic and the operator can pre-fund it from
//                       their main wallet before each head opens.
//   merchant.hydra    — random per head (in-head snapshot signing key,
//                       not L1-funded).
//   customer.*        — random per head (server-held in v1; see
//                       docs/ops/non-custody-spike.md for the v2 plan).

const KEYS_ROOT = process.env.HYDRA_KEYS_ROOT ?? "./infra/hydra/keys";

export type HeadKeyPaths = {
  merchant: KeyPair;
  customer: KeyPair;
};

export type KeyPair = {
  hydraSkPath: string;
  hydraVkPath: string;
  cardanoSkPath: string;
  cardanoVkPath: string;
  hydraVkHex: string;
  cardanoVkHex: string;
};

export async function generateHeadKeys(
  headId: string,
  headIndex: number,
): Promise<HeadKeyPaths> {
  const dir = join(KEYS_ROOT, headId);
  await mkdir(dir, { recursive: true, mode: 0o700 });

  const merchant = await writePartyKeys(dir, "merchant", headIndex);
  const customer = await writePartyKeys(dir, "customer", headIndex);
  return { merchant, customer };
}

async function writePartyKeys(
  dir: string,
  role: "merchant" | "customer",
  _headIndex: number,
): Promise<KeyPair> {
  const hydra = await genHydraKeyPair();
  // v1: random per-head normal Ed25519 cardano keys. hydra-node 1.3.0 rejects
  // BIP32-extended keys (PaymentExtendedSigningKeyShelley_ed25519_bip32). The
  // operator funds each fresh address from their main wallet — the orchestrator
  // surfaces the address in the enrollment response (Phase F task).
  const cardano = genCardanoKeyPair();

  const hydraSkPath = join(dir, `${role}-hydra.sk`);
  const hydraVkPath = join(dir, `${role}-hydra.vk`);
  const cardanoSkPath = join(dir, `${role}-cardano.sk`);
  const cardanoVkPath = join(dir, `${role}-cardano.vk`);

  await writeTextEnvelope(hydraSkPath, "HydraSigningKey_ed25519", "Hydra Signing Key", hydra.skHex);
  await writeTextEnvelope(hydraVkPath, "HydraVerificationKey_ed25519", "Hydra Verification Key", hydra.vkHex);
  // Merchant SK is extended (64-byte BIP32-derived); customer SK is normal (32-byte).
  if (cardano.extended) {
    await writeTextEnvelope(
      cardanoSkPath,
      "PaymentExtendedSigningKeyShelley_ed25519_bip32",
      "Payment Signing Key",
      cardano.skHex,
    );
  } else {
    await writeTextEnvelope(
      cardanoSkPath,
      "PaymentSigningKeyShelley_ed25519",
      "Payment Signing Key",
      cardano.skHex,
    );
  }
  await writeTextEnvelope(
    cardanoVkPath,
    "PaymentVerificationKeyShelley_ed25519",
    "Payment Verification Key",
    cardano.vkHex,
  );

  await chmod(hydraSkPath, 0o600);
  await chmod(cardanoSkPath, 0o600);

  return {
    hydraSkPath,
    hydraVkPath,
    cardanoSkPath,
    cardanoVkPath,
    hydraVkHex: hydra.vkHex,
    cardanoVkHex: cardano.vkHex,
  };
}

async function genHydraKeyPair(): Promise<{ skHex: string; vkHex: string }> {
  const sk = ed25519.utils.randomPrivateKey();
  const vk = await ed25519.getPublicKey(sk);
  return { skHex: bytesToHex(sk), vkHex: bytesToHex(vk) };
}

function genCardanoKeyPair(): { skHex: string; vkHex: string; extended: false } {
  const sk = csl.PrivateKey.generate_ed25519();
  const vk = sk.to_public();
  return {
    skHex: bytesToHex(sk.as_bytes()),
    vkHex: bytesToHex(vk.as_bytes()),
    extended: false,
  };
}

let cachedRootKey: csl.Bip32PrivateKey | null = null;

function getOperatorRootKey(): csl.Bip32PrivateKey {
  if (cachedRootKey) return cachedRootKey;
  const mnemonic = process.env.WALLET_SEED_PHRASE ?? process.env.MNEMONIC;
  if (!mnemonic) {
    throw new Error(
      "Operator seed missing: set WALLET_SEED_PHRASE or MNEMONIC to derive merchant keys",
    );
  }
  const entropy = mnemonicToEntropy(mnemonic);
  cachedRootKey = csl.Bip32PrivateKey.from_bip39_entropy(
    Buffer.from(entropy, "hex"),
    Buffer.from(""),
  );
  return cachedRootKey;
}

function harden(n: number): number {
  return 0x80000000 + n;
}

// CIP-1852 payment key at m/1852'/1815'/<account>'/0/<headIndex>.
function deriveCardanoKeyPair(
  account: number,
  headIndex: number,
): { skHex: string; vkHex: string; extended: true } {
  const root = getOperatorRootKey();
  const accountKey = root
    .derive(harden(1852))
    .derive(harden(1815))
    .derive(harden(account));
  const paymentBip32 = accountKey.derive(0).derive(headIndex);
  const paymentSk = paymentBip32.to_raw_key();
  const paymentVk = paymentSk.to_public();
  return {
    skHex: bytesToHex(paymentSk.as_bytes()),
    vkHex: bytesToHex(paymentVk.as_bytes()),
    extended: true,
  };
}

async function writeTextEnvelope(
  path: string,
  type: string,
  description: string,
  rawHex: string,
): Promise<void> {
  const envelope = {
    type,
    description,
    cborHex: cborByteStringHex(rawHex),
  };
  await writeFile(path, JSON.stringify(envelope, null, 2) + "\n", "utf8");
}

// CBOR bytestring header: 0x5820 for 32 bytes, 0x5840 for 64 bytes.
function cborByteStringHex(rawHex: string): string {
  if (rawHex.length === 64) return "5820" + rawHex;
  if (rawHex.length === 128) return "5840" + rawHex;
  throw new Error(`Unsupported key byte length: ${rawHex.length / 2}`);
}

function bytesToHex(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("hex");
}
