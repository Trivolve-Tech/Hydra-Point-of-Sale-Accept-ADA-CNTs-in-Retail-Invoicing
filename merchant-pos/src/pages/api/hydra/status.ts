import type { NextApiRequest, NextApiResponse } from "next";
import { getHydraRouter } from "~/server/hydra/singleton";
import { HydraConnectionState } from "~/server/hydra/types";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  const router = getHydraRouter();
  if (!router) {
    return res.status(200).json({
      available: false,
      headState: "Disabled",
      connectionState: HydraConnectionState.disconnected,
    });
  }

  const status = await router.getHeadStatus();
  res.status(200).json(status);
}
