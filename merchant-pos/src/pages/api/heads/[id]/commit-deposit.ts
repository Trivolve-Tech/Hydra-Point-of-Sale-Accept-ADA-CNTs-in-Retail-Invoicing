import type { NextApiRequest, NextApiResponse } from "next";
import { z } from "zod";
import axios from "axios";

import { getHeadById } from "~/server/heads";
import { getProfile, getProfileSpendKey } from "~/server/customer-profile";
import { listL1Utxos, submitToL1 } from "~/server/l1-submit";
import { signTxWithKey } from "~/server/in-head-tx";

/**
 * POST /api/heads/[id]/commit-deposit
 *
 * Body: { profile_id, amount_lovelace? }
 *
 * Hybrid commit: the user already Vespr-sent ADA to profile.depositAddress on
 * L1; we discover the UTxO(s) there, ask hydra-node /commit to draft the
 * commit tx, sign it with the per-customer server-held spend key, and
 * submit to L1. Returns the commit L1 tx id.
 *
 * If `amount_lovelace` is omitted we commit every UTxO currently at the
 * deposit address. If provided, we pick the smallest UTxO whose value
 * is >= amount, and commit just that one.
 */
const Body = z.object({
  profile_id: z.string().uuid(),
  amount_lovelace: z
    .union([z.string().regex(/^\d+$/), z.number().int().nonnegative()])
    .optional()
    .transform((v) => (v == null ? null : BigInt(v))),
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method Not Allowed" });
  const id = typeof req.query.id === "string" ? req.query.id : null;
  if (!id) return res.status(400).json({ error: "missing head id" });

  const parsed = Body.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.message });

  const head = await getHeadById(id);
  if (!head) return res.status(404).json({ error: "head not found" });

  const profile = await getProfile(parsed.data.profile_id);
  if (!profile) return res.status(404).json({ error: "profile not found" });

  const sk = await getProfileSpendKey(parsed.data.profile_id);
  if (!sk) return res.status(500).json({ error: "profile spend key missing" });

  let utxos;
  try {
    utxos = await listL1Utxos(profile.address);
  } catch (e) {
    return res
      .status(502)
      .json({ error: e instanceof Error ? e.message : "blockfrost utxo fetch failed" });
  }
  if (utxos.length === 0) {
    return res
      .status(400)
      .json({ error: `no L1 UTxO at deposit address ${profile.address} yet` });
  }

  let chosen: typeof utxos;
  if (parsed.data.amount_lovelace != null) {
    const want = parsed.data.amount_lovelace;
    const fit = utxos
      .filter((u) => u.lovelace >= want)
      .sort((a, b) => Number(a.lovelace - b.lovelace));
    if (fit.length === 0) {
      return res.status(400).json({
        error: `no L1 UTxO ≥ ${want} lovelace at deposit address (have ${utxos.length} total)`,
      });
    }
    chosen = [fit[0]!];
  } else {
    chosen = utxos;
  }

  const commitBody: Record<string, { address: string; value: { lovelace: number } }> = {};
  for (const u of chosen) {
    commitBody[u.ref] = {
      address: profile.address,
      value: { lovelace: Number(u.lovelace) },
    };
  }

  // Draft from hydra-node
  const port = head.merchantApiPort;
  let draftCborHex: string;
  try {
    const r = await axios.post<{ cborHex: string; type: string; description: string }>(
      `http://${process.env.HYDRA_NODE_HOST}:${port}/commit`,
      commitBody,
      { validateStatus: () => true, timeout: 30000 },
    );
    if (r.status !== 200 || !r.data?.cborHex) {
      const body = typeof r.data === "string" ? r.data : JSON.stringify(r.data);
      return res.status(502).json({ error: `hydra /commit ${r.status}: ${body.slice(0, 600)}` });
    }
    draftCborHex = r.data.cborHex;
  } catch (e) {
    return res
      .status(502)
      .json({ error: e instanceof Error ? e.message : "hydra /commit unreachable" });
  }

  // Sign with the per-customer server-held spend key
  let signedCborHex: string;
  try {
    signedCborHex = signTxWithKey(draftCborHex, sk);
  } catch (e) {
    return res.status(500).json({ error: `sign failed: ${e instanceof Error ? e.message : e}` });
  }

  // Submit to L1
  let l1TxId: string;
  try {
    l1TxId = await submitToL1(signedCborHex);
  } catch (e) {
    return res
      .status(502)
      .json({ error: e instanceof Error ? e.message : "L1 submit failed" });
  }

  return res.status(200).json({
    l1TxId,
    committed_utxos: chosen.map((u) => ({ ref: u.ref, lovelace: u.lovelace.toString() })),
  });
}
