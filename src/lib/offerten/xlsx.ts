import ExcelJS from "exceljs";
import type { QuoteDocument } from "./document";
import { INTERVAL_LABEL } from "./quote";

/**
 * Excel-Ausgabe mit echten Formeln: Menge und Rabatt sind gelb markiert und änderbar,
 * Beträge und Totale rechnen in Excel automatisch nach. Die berechneten Werte werden mitgeschrieben,
 * damit Vorschauen (Outlook, Handy) die Zahlen auch ohne Neuberechnung zeigen.
 */

const YELLOW = "FFF6BB12";
const YELLOW_SOFT = "FFFEF4D4";
const GREY = "FF6B6B6B";
const LINE = "FFE5E5E5";

export async function renderQuoteXlsx(doc: QuoteDocument): Promise<Buffer> {
  const L = doc.labels;
  const wb = new ExcelJS.Workbook();
  wb.creator = "Elev8 Orbit";
  wb.created = new Date();
  const ws = wb.addWorksheet(L.sheetQuote, {
    pageSetup: { paperSize: 9, orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
    views: [{ showGridLines: false }]
  });

  ws.columns = [
    { key: "title", width: 38 },
    { key: "detail", width: 52 },
    { key: "qty", width: 10 },
    { key: "unit", width: 14 },
    { key: "price", width: 14 },
    { key: "disc", width: 10 },
    { key: "interval", width: 14 },
    { key: "total", width: 16 }
  ];
  const fmtMoney = `"${doc.currency}" #,##0.00`;
  const font = { name: "Calibri", size: 11 };

  // Kopf
  ws.getCell("A1").value = doc.issuer.company || "Elev8 Suite";
  ws.getCell("A1").font = { ...font, size: 16, bold: true };
  ws.getCell("H1").value = `${L.document} ${doc.number}`;
  ws.getCell("H1").font = { ...font, size: 14, bold: true };
  ws.getCell("H1").alignment = { horizontal: "right" };
  ws.getRow(2).height = 4;
  for (let c = 1; c <= 8; c++) ws.getCell(2, c).fill = { type: "pattern", pattern: "solid", fgColor: { argb: YELLOW } };

  const meta: [string, string][] = [
    [L.for, [doc.recipient.company, doc.recipient.name].filter(Boolean).join(", ")],
    ...(doc.recipient.email ? ([["E-Mail", doc.recipient.email]] as [string, string][]) : []),
    [L.number, doc.number],
    [L.date, doc.dateText],
    [L.validUntil, doc.validUntilText],
    ...(doc.customerVatId ? ([[L.customerVatId, doc.customerVatId]] as [string, string][]) : []),
    ...(doc.contact.name
      ? ([[L.contact, [doc.contact.name, doc.contact.email, doc.contact.phone].filter(Boolean).join(", ")]] as [string, string][])
      : [])
  ];
  let r = 4;
  for (const [k, v] of meta) {
    ws.getCell(r, 1).value = k;
    ws.getCell(r, 1).font = { ...font, color: { argb: GREY } };
    ws.getCell(r, 2).value = v;
    ws.getCell(r, 2).font = { ...font, bold: true };
    r++;
  }
  r++;
  ws.mergeCells(r, 1, r, 8);
  ws.getCell(r, 1).value = doc.salutation;
  ws.getCell(r, 1).font = { ...font, bold: true };
  r++;
  ws.mergeCells(r, 1, r, 8);
  ws.getCell(r, 1).value = doc.intro;
  ws.getCell(r, 1).alignment = { wrapText: true, vertical: "top" };
  ws.getRow(r).height = Math.max(30, Math.ceil(doc.intro.length / 140) * 16);
  r += 2;

  ws.mergeCells(r, 1, r, 8);
  ws.getCell(r, 1).value = L.sheetHint;
  ws.getCell(r, 1).font = { ...font, italic: true, color: { argb: GREY } };
  r++;

  // Tabelle
  const head = [L.position, "", L.qty, "", L.unitPrice, `${L.discount} %`, L.interval, L.total];
  head.forEach((h, i) => {
    const cell = ws.getCell(r, i + 1);
    cell.value = h;
    cell.font = { ...font, bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF000000" } };
    cell.alignment = { horizontal: i >= 2 ? "right" : "left", vertical: "middle" };
  });
  ws.getRow(r).height = 22;
  const headerRow = r;
  r++;

  const first = r;
  for (const line of doc.lines) {
    const row = ws.getRow(r);
    row.getCell(1).value = line.title;
    row.getCell(1).font = { ...font, bold: true };
    row.getCell(2).value = line.detail;
    row.getCell(2).font = { ...font, size: 10, color: { argb: GREY } };
    row.getCell(3).value = line.qty;
    row.getCell(4).value = line.unit;
    row.getCell(5).value = line.unitPrice;
    row.getCell(5).numFmt = fmtMoney;
    row.getCell(6).value = line.discountPercent;
    row.getCell(6).numFmt = "0.##";
    row.getCell(7).value = line.intervalText;
    row.getCell(8).value = { formula: `C${r}*E${r}*(1-F${r}/100)`, result: line.total };
    row.getCell(8).numFmt = fmtMoney;
    row.getCell(8).font = { ...font, bold: true };
    for (const c of [3, 6]) row.getCell(c).fill = { type: "pattern", pattern: "solid", fgColor: { argb: YELLOW_SOFT } };
    for (let c = 1; c <= 8; c++) {
      row.getCell(c).alignment = { vertical: "top", wrapText: c <= 2, horizontal: c >= 3 && c !== 4 && c !== 7 ? "right" : "left" };
      row.getCell(c).border = { bottom: { style: "thin", color: { argb: LINE } } };
    }
    row.height = Math.max(20, Math.ceil(Math.max(line.detail.length / 60, line.title.length / 40)) * 15);
    r++;
  }
  const last = r - 1;
  r++;

  // Totale je Abrechnungsart mit SUMIF, damit Änderungen in Excel durchrechnen
  const tax = doc.taxPercent;
  const firstYearParts: string[] = [];
  const sumIf = (label: string) => `SUMIF($G$${first}:$G$${last},"${label}",$H$${first}:$H$${last})`;
  const totalRow = (interval: "once" | "monthly" | "yearly") => doc.totals.find((t) => t.interval === interval && t.kind === "total");

  for (const interval of ["once", "monthly", "yearly"] as const) {
    if (!doc.lines.some((l) => l.interval === interval)) continue;
    const intervalText = INTERVAL_LABEL[doc.lang][interval];
    const formula = tax > 0 ? `${sumIf(intervalText)}*(1+${tax}/100)` : sumIf(intervalText);
    ws.getCell(r, 7).value = totalRow(interval)?.label ?? interval;
    ws.getCell(r, 7).font = { ...font, bold: true };
    ws.getCell(r, 7).alignment = { horizontal: "right" };
    ws.getCell(r, 8).value = { formula, result: totalRow(interval)?.amount ?? 0 };
    ws.getCell(r, 8).numFmt = fmtMoney;
    ws.getCell(r, 8).font = { ...font, bold: true };
    ws.getCell(r, 8).fill = { type: "pattern", pattern: "solid", fgColor: { argb: YELLOW_SOFT } };
    firstYearParts.push(interval === "monthly" ? `H${r}*12` : `H${r}`);
    r++;
  }
  const firstYearRow = doc.totals.find((t) => t.kind === "firstYear");
  if (firstYearRow) {
    ws.getCell(r, 7).value = firstYearRow.label;
    ws.getCell(r, 7).font = { ...font, bold: true };
    ws.getCell(r, 7).alignment = { horizontal: "right" };
    ws.getCell(r, 8).value = { formula: firstYearParts.join("+"), result: firstYearRow.amount };
    ws.getCell(r, 8).numFmt = fmtMoney;
    ws.getCell(r, 8).font = { ...font, bold: true };
    ws.getCell(r, 8).border = { top: { style: "medium", color: { argb: YELLOW } } };
    r++;
  }
  if (tax > 0) {
    ws.getCell(r, 7).value = `${L.tax} ${tax} %`;
    ws.getCell(r, 7).font = { ...font, size: 10, color: { argb: GREY } };
    ws.getCell(r, 7).alignment = { horizontal: "right" };
    r++;
  }
  r++;

  const notes = doc.notes.split("\n").map((n) => n.replace(/^[-•*]\s*/, "").trim()).filter(Boolean);
  if (notes.length) {
    ws.getCell(r, 1).value = L.notes;
    ws.getCell(r, 1).font = { ...font, bold: true };
    r++;
    for (const n of notes) {
      ws.mergeCells(r, 1, r, 8);
      ws.getCell(r, 1).value = `• ${n}`;
      ws.getCell(r, 1).alignment = { wrapText: true };
      r++;
    }
    r++;
  }
  ws.mergeCells(r, 1, r, 8);
  ws.getCell(r, 1).value = doc.closing;
  ws.getCell(r, 1).alignment = { wrapText: true, vertical: "top" };
  ws.getRow(r).height = Math.max(20, Math.ceil(doc.closing.length / 140) * 16);
  r += 2;
  if (doc.assistant) {
    ws.getCell(r, 1).value = L.questions;
    ws.getCell(r, 1).font = { ...font, bold: true };
    r++;
    ws.mergeCells(r, 1, r, 8);
    ws.getCell(r, 1).value = { text: `${doc.assistant.text} ${doc.assistant.phone}`, hyperlink: doc.assistant.link };
    ws.getCell(r, 1).alignment = { wrapText: true };
    r++;
    ws.mergeCells(r, 1, r, 8);
    ws.getCell(r, 1).value = doc.assistant.tip;
    ws.getCell(r, 1).alignment = { wrapText: true };
    ws.getCell(r, 1).font = { ...font, size: 10, color: { argb: GREY } };
    r++;
    r++;
  }
  ws.getCell(r, 1).value = L.terms;
  ws.getCell(r, 1).font = { ...font, bold: true };
  r++;
  ws.mergeCells(r, 1, r, 8);
  ws.getCell(r, 1).value = (doc.reverseCharge ? [doc.taxNote, doc.terms] : [doc.terms]).join(" ");
  ws.getCell(r, 1).alignment = { wrapText: true, vertical: "top" };
  ws.getCell(r, 1).font = { ...font, size: 10, color: { argb: GREY } };
  ws.getRow(r).height = Math.max(30, Math.ceil(doc.terms.length / 140) * 15);
  r += 2;
  const footer = [doc.issuer.company, ...doc.issuer.addressLines, doc.issuer.taxId, doc.issuer.website].filter(Boolean).join(" · ");
  if (footer) {
    ws.mergeCells(r, 1, r, 8);
    ws.getCell(r, 1).value = footer;
    ws.getCell(r, 1).font = { ...font, size: 9, color: { argb: GREY } };
  }

  ws.pageSetup.printTitlesRow = `${headerRow}:${headerRow}`;

  const buffer = await wb.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
