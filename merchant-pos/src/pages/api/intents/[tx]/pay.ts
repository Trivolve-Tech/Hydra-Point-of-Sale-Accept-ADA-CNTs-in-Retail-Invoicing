import type { NextApiRequest, NextApiResponse } from "next";
import { z } from "zod";
import { desc } from "drizzle-orm";
import axios from "axios";
import * as csl from "@emurgo/cardano-serialization-lib-nodejs";

import { getIntentByTxId, markFailed, markPaid } from "~/server/intents";
import { getDb } from "~/server/db/client";
import { heads } from "~/server/db/schema";
import { getProfile, getProfileSpendKey } from "~/server/customer-profile";
import { getHeadKeyByRole } from "~/server/head_keys";
import { buildAndSignInHeadTx } from "~/server/in-head-tx";

/**
 * POST /api/intents/[tx]/pay
 *
 * Hybrid pay path: server holds the L2 spend key for the customer profile;
 * it builds the in-head tx, signs it, and submits to hydra-node /transaction.
 * No wallet signing required — Vespr/Eternl/Lace can't see in-head UTxOs.
 */
const Body = z.object({
  profile_id: z.string().uuid(),
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method Not Allowed" });
  const tx = typeof req.query.tx === "string" ? req.query.tx : null;
  if (!tx) return res.status(400).json({ error: "missing tx" });

  const intent = getIntentByTxId(tx);
  if (!intent) return res.status(404).json({ error: "intent not found" });
  if (intent.status === "paid") return res.status(200).json({ intent });

  const parsed = Body.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.message });

  // Authorize: the intent must target this profile (or have no target)
  if (intent.customer_id && intent.customer_id !== parsed.data.profile_id) {
    return res.status(403).json({ error: "intent is not addressed to this profile" });
  }

  const profile = await getProfile(parsed.data.profile_id);
  if (!profile) return res.status(404).json({ error: "profile not found" });

  const sk = await getProfileSpendKey(parsed.data.profile_id);
  if (!sk) return res.status(500).json({ error: "profile spend key missing" });

  const rows = await getDb().select().from(heads).orderBy(desc(heads.openedAt)).limit(1);
  const head = rows[0];
  if (!head) {
    markFailed(tx, "no head opened");
    return res.status(503).json({ error: "no head opened" });
  }

  // Merchant in-head destination
  const merchantKey = await getHeadKeyByRole(head.id, "merchant");
  if (!merchantKey) {
    markFailed(tx, "merchant head key missing");
    return res.status(500).json({ error: "merchant head key missing" });
  }
  const networkId = csl.NetworkInfo.mainnet().network_id();
  const merchantVk = csl.PublicKey.from_hex(merchantKey.cardanoVk);
  const merchantAddr = csl
    .EnterpriseAddress.new(networkId, csl.Credential.from_keyhash(merchantVk.hash()))
    .to_address();

  // Build + sign
  let signedCborHex: string;
  let inputUtxoRef: string;
  try {
    const built = await buildAndSignInHeadTx({
      hydraHost: process.env.HYDRA_NODE_HOST ?? "localhost",
      hydraPort: head.merchantApiPort,
      fromAddress: profile.address,
      fromSk: sk,
      toAddress: merchantAddr,
      amountLovelace: BigInt(intent.amount_lovelace),
    });
    signedCborHex = built.cborHex;
    inputUtxoRef = built.inputUtxoRef;
  } catch (e) {
    const reason = e instanceof Error ? e.message : "build-and-sign failed";
    markFailed(tx, reason);
    return res.status(400).json({ error: reason });
  }

  // eslint-disable-next-line no-console
  console.log(
    `[/api/intents/${tx}/pay] profile=${profile.id} input=${inputUtxoRef} cbor=${signedCborHex.length}c -> hydra:${head.merchantApiPort}/transaction`,
  );

  try {
    const r = await axios.post(
      `http://${process.env.HYDRA_NODE_HOST}:${head.merchantApiPort}/transaction`,
      { type: "Tx ConwayEra", description: "", cborHex: signedCborHex },
      { validateStatus: () => true, timeout: 10000 },
    );
    // hydra-node v1.3 returns 202 Accepted with {tag:"SubmitTxSubmitted"} on
    // successful submission; 200 is treated as success too for compat.
    if (r.status !== 200 && r.status !== 202) {
      const body = typeof r.data === "string" ? r.data : JSON.stringify(r.data);
      const reason = `hydra-node /transaction ${r.status}: ${body.slice(0, 800)}`;
      markFailed(tx, reason);
      return res.status(502).json({ error: reason });
    }
    const txId = (r.data as { txId?: string }).txId ?? "submitted";
    const paid = markPaid(tx, txId);
    return res.status(200).json({ intent: paid, transactionId: txId });
  } catch (e) {
    const reason = e instanceof Error ? e.message : "submit failed";
    markFailed(tx, reason);
    return res.status(502).json({ error: reason });
  }
}
