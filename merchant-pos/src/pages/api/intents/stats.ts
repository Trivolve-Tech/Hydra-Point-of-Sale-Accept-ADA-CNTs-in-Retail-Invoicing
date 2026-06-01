import type { NextApiRequest, NextApiResponse } from "next";
import { intentStats } from "~/server/intents";

export default async function handler(_req: NextApiRequest, res: NextApiResponse) {
  res.status(200).json(intentStats());
}
