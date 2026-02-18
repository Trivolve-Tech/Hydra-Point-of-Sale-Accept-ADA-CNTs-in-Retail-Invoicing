import type { NextApiRequest, NextApiResponse } from "next";
import axios from "axios";

function backendBaseUrl() {
  return (
    process.env.INVOICE_BACKEND_URL?.replace(/\/+$/, "") ??
    "http://localhost:7071"
  );
}

export default async function handler(_req: NextApiRequest, res: NextApiResponse) {
  const base = backendBaseUrl();

  try {
    const response = await axios.get(`${base}/exports/invoices.xlsx`, {
      responseType: "arraybuffer",
      validateStatus: () => true,
    });

    res.setHeader(
      "Content-Type",
      response.headers["content-type"] ??
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
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

