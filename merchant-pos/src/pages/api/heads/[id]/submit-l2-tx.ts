import type { NextApiRequest, NextApiResponse } from "next";
import { z } from "zod";
import axios from "axios";

import { getHeadById } from "~/server/heads";

const Body = z.object({
  signed_cbor: z.string().regex(/^[0-9a-fA-F]+$/),
});

/**
 * POST /api/heads/[id]/submit-l2-tx
 *
 * Forwards a Vespr-signed in-head Cardano tx to hydra-node's `/transaction`
 * HTTP endpoint. Returns the hydra tx id on success.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method Not Allowed" });
  const id = typeof req.query.id === "string" ? req.query.id : null;
  if (!id) return res.status(400).json({ error: "missing head id" });

  const parsed = Body.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.message });

  const head = await getHeadById(id);
  if (!head) return res.status(404).json({ error: "head not found" });

  const port = head.merchantApiPort;
  try {
    const r = await axios.post(
      `http://${process.env.HYDRA_NODE_HOST}:${port}/transaction`,
      { type: "Tx ConwayEra", description: "", cborHex: parsed.data.signed_cbor },
      { validateStatus: () => true, timeout: 10000 },
    );
    if (r.status !== 200) {
      const body = typeof r.data === "string" ? r.data : JSON.stringify(r.data);
      return res
        .status(502)
        .json({ error: `hydra-node /transaction ${r.status}: ${body.slice(0, 800)}` });
    }
    const txId = (r.data as { txId?: string }).txId ?? null;
    return res.status(200).json({ success: true, transactionId: txId });
  } catch (e) {
    return res
      .status(502)
      .json({ error: e instanceof Error ? e.message : "submit failed" });
  }
}
