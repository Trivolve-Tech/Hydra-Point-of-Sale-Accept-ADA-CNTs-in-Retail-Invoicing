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

  try {
    if (req.method === "GET") {
      const response = await axios.get(`${base}/invoices`, {
        params: req.query,
        validateStatus: () => true,
      });
      return res.status(response.status).json(response.data);
    }

    if (req.method === "POST") {
      const response = await axios.post(`${base}/invoices`, req.body, {
        validateStatus: () => true,
      });
      return res.status(response.status).json(response.data);
    }

    return res.status(405).json({ error: "Method Not Allowed" });
  } catch (error) {
    console.error(error);
    return res.status(502).json({ error: "Invoice backend unreachable" });
  }
}

