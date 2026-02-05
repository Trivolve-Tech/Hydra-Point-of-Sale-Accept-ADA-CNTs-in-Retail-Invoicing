import express from "express";
import cors from "cors";
import { z } from "zod";

import {
  createInvoice,
  deleteInvoice,
  getInvoice,
  listInvoices,
  updateInvoice,
} from "./store.js";
import {
  CreateInvoiceBodySchema,
  UpdateInvoiceBodySchema,
  computeTotal,
  InvoiceStatusSchema,
} from "./validation.js";
import { buildInvoicePdfBuffer, buildInvoicesXlsxBuffer } from "./export.js";

const app = express();
app.use(cors());
app.use(express.json({ limit: "1mb" }));

const PORT = Number(process.env.PORT ?? 7071);

app.get("/health", (_req, res) => {
  res.status(200).json({ ok: true });
});

app.get("/invoices", async (req, res) => {
  const QuerySchema = z.object({
    status: InvoiceStatusSchema.optional(),
    q: z.string().optional(),
    limit: z.coerce.number().int().min(1).max(200).optional(),
    offset: z.coerce.number().int().min(0).optional(),
  });

  const { status, q, limit, offset } = QuerySchema.parse(req.query);
  const rows = await listInvoices({ status, q, limit, offset });
  res.status(200).json({ invoices: rows });
});

app.post("/invoices", async (req, res) => {
  const body = CreateInvoiceBodySchema.parse(req.body);

  // If line items are provided, derive the invoice total from them.
  const total = computeTotal(body.asset, body.line_items);
  const created = await createInvoice({
    ...body,
    asset: { ...body.asset, quantity: total },
  });

  res.status(201).json(created);
});

app.get("/invoices/:id", async (req, res) => {
  const inv = await getInvoice(req.params.id);
  if (!inv) return res.status(404).json({ error: "Invoice not found" });
  res.status(200).json(inv);
});

app.patch("/invoices/:id", async (req, res) => {
  const body = UpdateInvoiceBodySchema.parse(req.body);

  if (body.line_items) {
    const current = await getInvoice(req.params.id);
    if (!current) return res.status(404).json({ error: "Invoice not found" });
    const total = computeTotal(current.asset, body.line_items);
    body.asset = { ...(body.asset ?? current.asset), quantity: total };
  }

  const updated = await updateInvoice(req.params.id, body);
  if (!updated) return res.status(404).json({ error: "Invoice not found" });
  res.status(200).json(updated);
});

app.delete("/invoices/:id", async (req, res) => {
  const ok = await deleteInvoice(req.params.id);
  if (!ok) return res.status(404).json({ error: "Invoice not found" });
  res.status(204).end();
});

app.get("/invoices/:id/pdf", async (req, res) => {
  const inv = await getInvoice(req.params.id);
  if (!inv) return res.status(404).json({ error: "Invoice not found" });

  const buf = await buildInvoicePdfBuffer(inv);
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="${inv.number}.pdf"`,
  );
  res.status(200).send(buf);
});

app.get("/exports/invoices.xlsx", async (req, res) => {
  const invoices = await listInvoices({ limit: 10000, offset: 0 });
  const buf = await buildInvoicesXlsxBuffer(invoices);
  res.setHeader(
    "Content-Type",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  );
  res.setHeader(
    "Content-Disposition",
    'attachment; filename="invoices.xlsx"',
  );
  res.status(200).send(buf);
});

app.use((err, _req, res, _next) => {
  if (err?.name === "ZodError") {
    return res.status(400).json({ error: "Invalid request", details: err.issues });
  }
  console.error(err);
  res.status(500).json({ error: "Internal server error" });
});

app.listen(PORT, () => {
  console.log(`[invoice-backend] listening on :${PORT}`);
});

