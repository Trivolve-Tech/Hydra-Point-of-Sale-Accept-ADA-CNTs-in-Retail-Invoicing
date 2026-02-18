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
    if (response.headers["content-disposition"]) {
      res.setHeader("Content-Disposition", response.headers["content-disposition"]);
    }

    return res.status(response.status).send(Buffer.from(response.data));
  } catch (error) {
    console.error(error);
    return res.status(502).json({ error: "Invoice backend unreachable" });
  }
}

