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

  try {
    if (req.method === "GET") {
      const response = await axios.get(`${base}/invoices/${id}`, {
        validateStatus: () => true,
      });
      return res.status(response.status).json(response.data);
    }

    if (req.method === "PATCH") {
      const response = await axios.patch(`${base}/invoices/${id}`, req.body, {
        validateStatus: () => true,
      });
      return res.status(response.status).json(response.data);
    }

    if (req.method === "DELETE") {
      const response = await axios.delete(`${base}/invoices/${id}`, {
        validateStatus: () => true,
      });
      if (response.status === 204) return res.status(204).end();
      return res.status(response.status).json(response.data);
    }

    return res.status(405).json({ error: "Method Not Allowed" });
  } catch (error) {
    console.error(error);
    return res.status(502).json({ error: "Invoice backend unreachable" });
  }
}

