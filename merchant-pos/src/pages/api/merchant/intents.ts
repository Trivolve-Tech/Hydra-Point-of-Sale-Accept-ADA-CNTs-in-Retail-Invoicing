import type { NextApiRequest, NextApiResponse } from "next";
import { readFileSync, existsSync } from "fs";
import { join } from "path";
import type { PaymentRecord } from "~/server";

const STORE_PATH = join(process.cwd(), "data", "payment-records.json");

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  if (!existsSync(STORE_PATH)) {
    return res.status(200).json([]);
  }

  const records = JSON.parse(
    readFileSync(STORE_PATH, "utf-8"),
  ) as PaymentRecord[];

  const sorted = records
    .sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    )
    .slice(0, 50);

  res.status(200).json(sorted);
}
