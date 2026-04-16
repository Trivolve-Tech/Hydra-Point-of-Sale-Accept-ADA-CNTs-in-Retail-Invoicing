import type { NextApiRequest, NextApiResponse } from "next";
import axios from "axios";

function backendBaseUrl() {
  return (
    process.env.INVOICE_BACKEND_URL?.replace(/\/+$/, "") ??
    "http://localhost:7071"
  );
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const base = backendBaseUrl();
  const { id } = req.query;

  if (!id || typeof id !== "string") {
    return res.status(400).json({ error: "Invoice id is required" });
  }

  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  try {
    const response = await axios.get(`${base}/invoices/${id}/pdf`, {
      responseType: "arraybuffer",
      validateStatus: () => true,
    });

    res.setHeader(
      "Content-Type",
      response.headers["content-type"] ?? "application/pdf",
    );

    const inline = req.query.inline === "1";
    const rawCd = response.headers["content-disposition"];

    if (inline && response.status === 200) {
      const quoted = rawCd?.match(/filename="([^"]+)"/)?.[1];
      const bare = rawCd?.match(/filename=([^;\s]+)/)?.[1];
      const filename = (quoted ?? bare ?? `invoice-${id}.pdf`).replace(
        /^["']|["']$/g,
        "",
      );
      res.setHeader(
        "Content-Disposition",
        `inline; filename="${filename.replace(/"/g, '\\"')}"`,
      );
    } else if (rawCd) {
      res.setHeader("Content-Disposition", rawCd);
    }

    return res.status(response.status).send(Buffer.from(response.data));
  } catch (error) {
    console.error(error);
    return res.status(502).json({ error: "Invoice backend unreachable" });
  }
}

