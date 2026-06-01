import { generateHeadKeys } from "./keys";
import { composeUp, composeDown, renderAndWriteCompose, type ComposeRenderVars } from "./compose";
import { createHead, updateHead, getHeadById } from "~/server/heads";
import { createHeadKey } from "~/server/head_keys";
import { getHydraRegistry } from "~/server/hydra/registry";
import { max } from "drizzle-orm";
import { getDb } from "~/server/db/client";
import { heads, type Head } from "~/server/db/schema";

export type OpenHeadInput = {
  customerId: string;
};

const MERCHANT_API_BASE = 4100;
const CUSTOMER_API_BASE = 4500;
const MERCHANT_PEER_BASE = 5100;
const CUSTOMER_PEER_BASE = 5500;
const MAX_HEADS = 400;

export async function openHeadForCustomer({ customerId }: OpenHeadInput): Promise<Head> {
  const network = (process.env.CARDANO_NETWORK ?? "preprod") as "preprod" | "mainnet";
  const contestation = network === "mainnet" ? 43200 : 60;
  const hydraScriptsTxId = requireEnv("HYDRA_SCRIPTS_TX_ID");

  const portBlock = await nextPortBlock();

  // 1) Insert the head row so the head_id is known and we can name the keys dir.
  const head = await createHead({
    customerId,
    merchantApiPort: portBlock.merchantApi,
    merchantPeerPort: portBlock.merchantPeer,
    customerApiPort: portBlock.customerApi,
    customerPeerPort: portBlock.customerPeer,
    contestationPeriodSeconds: contestation,
    state: "initializing",
  });

  // 2) Generate both parties' keypairs and persist them server-side (v1 fully
  //    custodial — see docs/ops/non-custody-spike.md for the v2 plan).
  //    Merchant cardano-sk is HD-derived from the operator MNEMONIC at index
  //    derived from port allocation, so the address is deterministic and
  //    pre-fundable from the operator wallet.
  const headIndex = portBlock.merchantApi - MERCHANT_API_BASE;
  const keys = await generateHeadKeys(head.id, headIndex);

  await createHeadKey({
    headId: head.id,
    role: "merchant",
    hydraVk: keys.merchant.hydraVkHex,
    cardanoVk: keys.merchant.cardanoVkHex,
    hydraSkPath: keys.merchant.hydraSkPath,
    cardanoSkPath: keys.merchant.cardanoSkPath,
  });
  await createHeadKey({
    headId: head.id,
    role: "customer",
    hydraVk: keys.customer.hydraVkHex,
    cardanoVk: keys.customer.cardanoVkHex,
    hydraSkPath: keys.customer.hydraSkPath,
    cardanoSkPath: keys.customer.cardanoSkPath,
  });

  // 3) Render the per-head Compose file from the template + spawn the pair.
  const composeVars: ComposeRenderVars = {
    HEAD_ID: head.id,
    NETWORK: network,
    TESTNET_MAGIC_FLAG:
      network === "preprod" ? '- --testnet-magic\n      - "1"' : "- --mainnet",
    MERCHANT_API_PORT: String(head.merchantApiPort),
    MERCHANT_PEER_PORT: String(head.merchantPeerPort),
    CUSTOMER_API_PORT: String(head.customerApiPort),
    CUSTOMER_PEER_PORT: String(head.customerPeerPort),
    HYDRA_SCRIPTS_TX_ID: hydraScriptsTxId,
    // hydra-node 1.3.0 parses --contestation-period as a Haskell duration ("12h" or "43200s").
    CONTESTATION_PERIOD_SECONDS: `${head.contestationPeriodSeconds}s`,
    MERCHANT_HYDRA_SK_PATH: keys.merchant.hydraSkPath,
    MERCHANT_CARDANO_SK_PATH: keys.merchant.cardanoSkPath,
    MERCHANT_HYDRA_VK_PATH: keys.merchant.hydraVkPath,
    MERCHANT_CARDANO_VK_PATH: keys.merchant.cardanoVkPath,
    CUSTOMER_HYDRA_SK_PATH: keys.customer.hydraSkPath,
    CUSTOMER_CARDANO_SK_PATH: keys.customer.cardanoSkPath,
    CUSTOMER_HYDRA_VK_PATH: keys.customer.hydraVkPath,
    CUSTOMER_CARDANO_VK_PATH: keys.customer.cardanoVkPath,
    BASE_NETWORK: `hydra-pos-${network}`,
  };
  const composeFile = await renderAndWriteCompose(composeVars);

  try {
    await composeUp(composeFile);
  } catch (e) {
    await updateHead(head.id, { state: "failed" });
    throw new Error(`docker compose up failed: ${e instanceof Error ? e.message : String(e)}`);
  }

  // 4) Send Init via the merchant-side WebSocket once the node is reachable.
  //    We let the registry handle the connect retries.
  const facade = await getHydraRegistry().getFacade(head.id);
  if (!facade) {
    await updateHead(head.id, { state: "failed" });
    throw new Error("Hydra facade could not be constructed for new head");
  }
  facade.sendInit();

  return head;
}

export async function closeHead(headId: string): Promise<void> {
  const head = await getHeadById(headId);
  if (!head) throw new Error(`Head ${headId} not found`);
  const facade = await getHydraRegistry().getFacade(headId);
  facade?.sendSafeClose();
  await updateHead(headId, { state: "closed", closedAt: new Date() });
}

export async function tearDownHead(headId: string): Promise<void> {
  const composeFile = `${process.env.HYDRA_HEADS_DIR ?? "./infra/docker/heads"}/${headId}.yml`;
  try {
    await composeDown(composeFile);
  } catch {
    // best-effort
  }
  await getHydraRegistry().close(headId);
}

async function nextPortBlock(): Promise<{
  merchantApi: number;
  merchantPeer: number;
  customerApi: number;
  customerPeer: number;
}> {
  const result = await getDb().select({ max: max(heads.merchantApiPort) }).from(heads);
  const previous = result[0]?.max ?? MERCHANT_API_BASE - 1;
  const n = previous - (MERCHANT_API_BASE - 1);
  if (n >= MAX_HEADS) {
    throw new Error(`Port range exhausted; raise MAX_HEADS or expand range`);
  }
  return {
    merchantApi: MERCHANT_API_BASE + n,
    merchantPeer: MERCHANT_PEER_BASE + n,
    customerApi: CUSTOMER_API_BASE + n,
    customerPeer: CUSTOMER_PEER_BASE + n,
  };
}

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Required env var missing: ${name}`);
  return v;
}
