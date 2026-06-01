import { promises as fs } from "node:fs";
import path from "node:path";
import { nanoid } from "nanoid";

const DATA_DIR = process.env.DATA_DIR ?? path.join(process.cwd(), "data");
const DATA_FILE = path.join(DATA_DIR, "invoices.json");

async function ensureDataFile() {
  await fs.mkdir(DATA_DIR, { recursive: true });
  try {
    await fs.access(DATA_FILE);
  } catch {
    await fs.writeFile(
      DATA_FILE,
      JSON.stringify({ invoices: [] }, null, 2) + "\n",
      "utf8",
    );
  }
}

async function readDb() {
  await ensureDataFile();
  const raw = await fs.readFile(DATA_FILE, "utf8");
  const parsed = JSON.parse(raw);
  if (!parsed || typeof parsed !== "object" || !Array.isArray(parsed.invoices)) {
    return { invoices: [] };
  }
  return parsed;
}

async function writeDb(db) {
  await ensureDataFile();
  await fs.writeFile(DATA_FILE, JSON.stringify(db, null, 2) + "\n", "utf8");
}

export function nowIso() {
  return new Date().toISOString();
}

export function newInvoiceId() {
  return `inv_${nanoid(12)}`;
}

export function newInvoiceNumber() {
  const d = new Date();
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `INV-${y}${m}${day}-${nanoid(6).toUpperCase()}`;
}

export async function listInvoices({ status, q, limit = 50, offset = 0 } = {}) {
  const db = await readDb();
  let invoices = db.invoices;

  if (status) invoices = invoices.filter((i) => i.status === status);
  if (q) {
    const needle = String(q).toLowerCase();
    invoices = invoices.filter((i) => {
      return (
        String(i.number ?? "").toLowerCase().includes(needle) ||
        String(i.customer?.name ?? "").toLowerCase().includes(needle) ||
        String(i.customer?.email ?? "").toLowerCase().includes(needle) ||
        String(i.reference ?? "").toLowerCase().includes(needle)
      );
    });
  }

  invoices = invoices.sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
  return invoices.slice(offset, offset + limit);
}

export async function getInvoice(id) {
  const db = await readDb();
  return db.invoices.find((i) => i.id === id) ?? null;
}

export async function createInvoice(invoice) {
  const db = await readDb();
  const created = {
    ...invoice,
    id: newInvoiceId(),
    number: invoice.number ?? newInvoiceNumber(),
    created_at: nowIso(),
    updated_at: nowIso(),
    history: [
      {
        at: nowIso(),
        event: "invoice.created",
        data: { status: invoice.status },
      },
    ],
  };
  db.invoices.push(created);
  await writeDb(db);
  return created;
}

export async function updateInvoice(id, patch) {
  const db = await readDb();
  const idx = db.invoices.findIndex((i) => i.id === id);
  if (idx === -1) return null;

  const prev = db.invoices[idx];
  const next = {
    ...prev,
    ...patch,
    id: prev.id,
    number: prev.number,
    created_at: prev.created_at,
    updated_at: nowIso(),
  };

  const statusChanged = patch.status && patch.status !== prev.status;
  const nextHistory = Array.isArray(prev.history) ? [...prev.history] : [];
  nextHistory.push({
    at: nowIso(),
    event: statusChanged ? "invoice.status_updated" : "invoice.updated",
    data: statusChanged ? { from: prev.status, to: patch.status } : {},
  });

  next.history = nextHistory;
  db.invoices[idx] = next;
  await writeDb(db);
  return next;
}

export async function deleteInvoice(id) {
  const db = await readDb();
  const before = db.invoices.length;
  db.invoices = db.invoices.filter((i) => i.id !== id);
  const after = db.invoices.length;
  if (after === before) return false;
  await writeDb(db);
  return true;
}

