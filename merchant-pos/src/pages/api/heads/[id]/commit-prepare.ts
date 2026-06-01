import type { NextApiRequest, NextApiResponse } from "next";
import { z } from "zod";
import axios from "axios";

import { getHeadById } from "~/server/heads";

/**
 * POST /api/heads/[id]/commit-prepare
 *
 * Body: { wallet_address, utxo_ref, utxo_lovelace }
 *
 * Asks hydra-node `/commit` to draft a tx that commits the given UTxO into the
 * head. Returns the draft tx CBOR for the user's wallet (Vespr) to sign.
 *
 * The draft tx spends the specified UTxO; only the owner of that UTxO can
 * sign it. Non-custodial: server never touches a private key.
 */
const Body = z.object({
  wallet_address: z.string().min(50).max(200),
  utxo_ref: z.string().regex(/^[0-9a-fA-F]+#\d+$/),
  utxo_lovelace: z
    .union([z.string().regex(/^\d+$/), z.number().int().nonnegative()])
    .transform((v) => Number(v)),
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method Not Allowed" });
  const id = typeof req.query.id === "string" ? req.query.id : null;
  if (!id) return res.status(400).json({ error: "missing head id" });

  const parsed = Body.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.message });
  const { wallet_address, utxo_ref, utxo_lovelace } = parsed.data;

  const head = await getHeadById(id);
  if (!head) return res.status(404).json({ error: "head not found" });

  const port = head.merchantApiPort;
  const commitBody = {
    [utxo_ref]: {
      address: wallet_address,
      value: { lovelace: utxo_lovelace },
    },
  };
  try {
    const r = await axios.post(
      `http://${process.env.HYDRA_NODE_HOST}:${port}/commit`,
      commitBody,
      { validateStatus: () => true, timeout: 30000 },
    );
    if (r.status !== 200) {
      const body = typeof r.data === "string" ? r.data : JSON.stringify(r.data);
      return res
        .status(502)
        .json({ error: `hydra-node /commit ${r.status}: ${body.slice(0, 800)}` });
    }
    // r.data is { type, description, cborHex } — pass it straight back.
    return res.status(200).json({ draft: r.data });
  } catch (e) {
    return res
      .status(502)
      .json({ error: e instanceof Error ? e.message : "hydra-node unreachable" });
  }
}
