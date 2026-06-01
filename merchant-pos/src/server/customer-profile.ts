/**
 * Customer-profile management — HYBRID v3.
 *
 * Pure non-custodial L2 signing is impossible with standard CIP-30 wallets
 * (Vespr/Eternl/Lace): when a Hydra-head UTxO doesn't exist on L1, the
 * wallet refuses to produce a witness for it. So:
 *
 *   - L1 stays non-custodial. The user's wallet signs the L1 send into the
 *     head's per-customer "deposit address".
 *   - L2 spend authority is delegated to a server-held ed25519 key (one per
 *     customer). The server signs in-head txs.
 *
 * `profile.address` == the L1 enterprise address derived from the server-held
 * key. Funds at this address are spendable in-head by the server only while
 * the head is open. On fan-out / close, any remaining in-head UTxOs return to
 * this same L1 address, where the server can fan them back to the user's
 * wallet address (or the user can withdraw via /api/heads/[id]/return-funds
 * — TODO).
 */
import * as csl from "@emurgo/cardano-serialization-lib-nodejs";
import * as crypto from "crypto";

import {
  listCustomers,
  createCustomer,
  getCustomerById,
  updateCustomer,
} from "~/server/customers";
import type { Customer } from "~/server/db/schema";

export type CustomerProfile = {
  id: string;
  label: string | null;
  /** L1 enterprise address derived from the server-held spend key. The user
   *  sends ADA HERE from their wallet; this address holds committed UTxOs
   *  and is spent in-head by the server. */
  address: string;
  /** The user's wallet base address (Vespr/Eternl/Lace). Display-only. */
  walletAddress: string | null;
  /** Stake (or first-used) address used as idempotency key. */
  ownerAddress: string | null;
  status: string;
  enrolledAt: Date;
};

const NETWORK = process.env.CARDANO_NETWORK === "preprod" ? "preprod" : "mainnet";

function networkId(): number {
  return NETWORK === "mainnet"
    ? csl.NetworkInfo.mainnet().network_id()
    : csl.NetworkInfo.testnet_preprod().network_id();
}

function deriveDepositAddress(sk: csl.PrivateKey): string {
  const cred = csl.Credential.from_keyhash(sk.to_public().hash());
  return csl.EnterpriseAddress.new(networkId(), cred).to_address().to_bech32();
}

function encSecret(): Buffer {
  const s = process.env.HPOS_KEY_SECRET;
  if (!s) throw new Error("HPOS_KEY_SECRET env required for L2 spend key storage");
  return crypto.createHash("sha256").update(s).digest();
}

function encrypt(plain: string): string {
  const key = encSecret();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString("base64");
}

function decrypt(b64: string): string {
  const key = encSecret();
  const buf = Buffer.from(b64, "base64");
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const enc = buf.subarray(28);
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(enc), decipher.final()]).toString("utf8");
}

function meta(c: Customer): Record<string, unknown> {
  return (c.metadata as Record<string, unknown> | null) ?? {};
}

/** Get or create the server-held L2 spend key for this customer.
 *  Lazy-migrates pre-v3 rows that lack one. */
async function ensureSpendKey(c: Customer): Promise<{
  privKeyHex: string;
  pubKeyHex: string;
  depositAddress: string;
}> {
  const m = meta(c);
  if (
    typeof m.spendKeyEnc === "string" &&
    typeof m.spendKeyVk === "string" &&
    typeof m.depositAddress === "string"
  ) {
    return {
      privKeyHex: decrypt(m.spendKeyEnc),
      pubKeyHex: m.spendKeyVk,
      depositAddress: m.depositAddress,
    };
  }
  const sk = csl.PrivateKey.generate_ed25519();
  const skHex = sk.to_hex();
  const vkHex = sk.to_public().to_hex();
  const depositAddress = deriveDepositAddress(sk);
  await updateCustomer(c.id, {
    metadata: {
      ...m,
      custody: "hybrid-l2-custodial",
      spendKeyEnc: encrypt(skHex),
      spendKeyVk: vkHex,
      depositAddress,
    },
  });
  return { privKeyHex: skHex, pubKeyHex: vkHex, depositAddress };
}

function toView(c: Customer, depositAddress: string): CustomerProfile {
  const m = meta(c);
  return {
    id: c.id,
    label: c.label,
    address: depositAddress,
    walletAddress: typeof m.walletAddress === "string" ? m.walletAddress : null,
    ownerAddress: typeof m.ownerAddress === "string" ? m.ownerAddress : null,
    status: c.status,
    enrolledAt: c.enrolledAt,
  };
}

export async function createProfile(params: {
  walletAddress: string;
  ownerAddress?: string;
  label?: string;
}): Promise<CustomerProfile> {
  const sk = csl.PrivateKey.generate_ed25519();
  const skHex = sk.to_hex();
  const vkHex = sk.to_public().to_hex();
  const depositAddress = deriveDepositAddress(sk);

  const row = await createCustomer({
    label: params.label,
    hydraVk: `hpos-vk:${vkHex}`,
    cardanoVk: `hpos-vk:${vkHex}`,
    metadata: {
      profile: true,
      walletAddress: params.walletAddress,
      ownerAddress: params.ownerAddress ?? params.walletAddress,
      custody: "hybrid-l2-custodial",
      spendKeyEnc: encrypt(skHex),
      spendKeyVk: vkHex,
      depositAddress,
    },
  });
  return toView(row, depositAddress);
}

export async function getProfile(id: string): Promise<CustomerProfile | null> {
  const c = await getCustomerById(id);
  if (!c) return null;
  const m = meta(c);
  if (m.profile !== true) return null;
  const { depositAddress } = await ensureSpendKey(c);
  return toView(c, depositAddress);
}

export async function listProfiles(): Promise<CustomerProfile[]> {
  const rows = await listCustomers(500);
  const out: CustomerProfile[] = [];
  for (const c of rows) {
    if (meta(c).profile !== true) continue;
    const { depositAddress } = await ensureSpendKey(c);
    out.push(toView(c, depositAddress));
  }
  return out;
}

export async function findProfileByOwner(
  ownerAddress: string,
): Promise<CustomerProfile | null> {
  const rows = await listCustomers(500);
  for (const c of rows) {
    const m = meta(c);
    if (m.profile === true && m.ownerAddress === ownerAddress) {
      const { depositAddress } = await ensureSpendKey(c);
      return toView(c, depositAddress);
    }
  }
  return null;
}

/** Returns the server-held L2 spend key for the given profile (or null). */
export async function getProfileSpendKey(
  id: string,
): Promise<csl.PrivateKey | null> {
  const c = await getCustomerById(id);
  if (!c) return null;
  if (meta(c).profile !== true) return null;
  const { privKeyHex } = await ensureSpendKey(c);
  return csl.PrivateKey.from_hex(privKeyHex);
}
