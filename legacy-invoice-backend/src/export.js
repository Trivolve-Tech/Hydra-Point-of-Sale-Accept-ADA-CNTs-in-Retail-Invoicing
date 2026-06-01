import ExcelJS from "exceljs";
import PDFDocument from "pdfkit";

export async function buildInvoicesXlsxBuffer(invoices) {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Invoices");

  ws.columns = [
    { header: "id", key: "id", width: 22 },
    { header: "number", key: "number", width: 20 },
    { header: "status", key: "status", width: 18 },
    { header: "asset_unit", key: "asset_unit", width: 32 },
    { header: "quantity", key: "quantity", width: 18 },
    { header: "customer_name", key: "customer_name", width: 22 },
    { header: "customer_email", key: "customer_email", width: 28 },
    { header: "reference", key: "reference", width: 22 },
    { header: "created_at", key: "created_at", width: 24 },
    { header: "updated_at", key: "updated_at", width: 24 },
    { header: "expiry_at", key: "expiry_at", width: 24 },
  ];

  for (const inv of invoices) {
    ws.addRow({
      id: inv.id,
      number: inv.number,
      status: inv.status,
      asset_unit: inv.asset?.unit,
      quantity: inv.asset?.quantity,
      customer_name: inv.customer?.name ?? "",
      customer_email: inv.customer?.email ?? "",
      reference: inv.reference ?? "",
      created_at: inv.created_at,
      updated_at: inv.updated_at,
      expiry_at: inv.expiry_at ?? "",
    });
  }

  ws.getRow(1).font = { bold: true };
  ws.views = [{ state: "frozen", ySplit: 1 }];

  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf);
}

export async function buildInvoicePdfBuffer(invoice) {
  const doc = new PDFDocument({ size: "A4", margin: 50 });
  const chunks = [];
  doc.on("data", (c) => chunks.push(c));

  const title = "Invoice";
  doc.fontSize(22).text(title, { align: "left" });
  doc.moveDown(0.5);

  doc
    .fontSize(10)
    .fillColor("#555")
    .text(`Invoice #: ${invoice.number}`)
    .text(`Invoice ID: ${invoice.id}`)
    .text(`Status: ${invoice.status}`)
    .text(`Created: ${invoice.created_at}`)
    .text(`Updated: ${invoice.updated_at}`);

  if (invoice.expiry_at) doc.text(`Expiry: ${invoice.expiry_at}`);
  if (invoice.reference) doc.text(`Reference: ${invoice.reference}`);

  doc.moveDown();
  doc.fillColor("#111").fontSize(12).text("Bill To");
  doc
    .fontSize(10)
    .fillColor("#555")
    .text(invoice.customer?.name ? invoice.customer.name : "(not provided)")
    .text(invoice.customer?.email ? invoice.customer.email : "")
    .text(invoice.customer?.phone ? invoice.customer.phone : "");

  doc.moveDown();
  doc.fillColor("#111").fontSize(12).text("Amount");
  doc
    .fontSize(10)
    .fillColor("#555")
    .text(`Asset unit: ${invoice.asset.unit}`)
    .text(`Quantity (base units): ${invoice.asset.quantity}`);

  if (invoice.line_items?.length) {
    doc.moveDown();
    doc.fillColor("#111").fontSize(12).text("Line items");
    doc.moveDown(0.25);

    doc.fontSize(10).fillColor("#111");
    for (const li of invoice.line_items) {
      doc.text(
        `- ${li.description} — qty ${li.quantity} @ ${li.unit_price} (base units)`,
      );
    }
  }

  if (invoice.notes) {
    doc.moveDown();
    doc.fillColor("#111").fontSize(12).text("Notes");
    doc.fontSize(10).fillColor("#555").text(invoice.notes);
  }

  doc.end();

  await new Promise((resolve, reject) => {
    doc.on("end", resolve);
    doc.on("error", reject);
  });

  return Buffer.concat(chunks);
}

