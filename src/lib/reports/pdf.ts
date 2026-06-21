// Pure, dependency-free PDF exporter for a ReportModel.
//
// Renders the report as a monospaced (Courier) text document so columns align
// without font metrics, paginating across A4 pages. Produces valid PDF bytes
// (a Uint8Array) we can hand to a Blob download. Not a typesetting engine — a
// clean, portable tabular export.

import { formatCell, type ReportModel, type ReportColumn, type ReportRow } from "./model";

const PAGE_W = 595;
const PAGE_H = 842;
const MARGIN = 40;
const FONT_SIZE = 9;
const LINE_H = 12;
const TOP_Y = PAGE_H - MARGIN;
const LINES_PER_PAGE = Math.floor((PAGE_H - 2 * MARGIN) / LINE_H); // ~63
const MAX_TEXT_WIDTH = 30; // cap for text/date columns (chars)

function pad(s: string, width: number, align: "left" | "right"): string {
  const t = s.length > width ? s.slice(0, width - 1) + "…" : s;
  return align === "right" ? t.padStart(width) : t.padEnd(width);
}

function columnWidths(columns: ReportColumn[], rows: ReportRow[], totals?: ReportRow): number[] {
  return columns.map((c) => {
    let w = c.label.length;
    const cells = totals ? [...rows, totals] : rows;
    for (const r of cells) w = Math.max(w, formatCell(r[c.key], c.type, "pdf").length);
    const cap = c.type === "text" ? MAX_TEXT_WIDTH : 18;
    return Math.min(Math.max(w, 3), cap);
  });
}

function alignOf(c: ReportColumn): "left" | "right" {
  return c.align ?? (c.type === "money" || c.type === "number" ? "right" : "left");
}

function rowLine(row: ReportRow, columns: ReportColumn[], widths: number[]): string {
  return columns.map((c, i) => pad(formatCell(row[c.key], c.type, "pdf"), widths[i], alignOf(c))).join("  ");
}

/** Flatten a model into printable text lines. */
export function reportToTextLines(model: ReportModel): string[] {
  const lines: string[] = [];
  lines.push(model.title.toUpperCase());
  if (model.subtitle) lines.push(model.subtitle);
  for (const m of model.meta) lines.push(`${m.label}: ${m.value}`);
  lines.push("");

  for (const section of model.sections) {
    if (section.title) lines.push(section.title);
    const widths = columnWidths(section.columns, section.rows, section.totals);
    const header = section.columns.map((c, i) => pad(c.label, widths[i], alignOf(c))).join("  ");
    lines.push(header);
    lines.push("-".repeat(header.length));
    if (section.rows.length === 0) lines.push(section.empty ?? "(no rows)");
    for (const r of section.rows) lines.push(rowLine(r, section.columns, widths));
    if (section.totals) {
      lines.push("-".repeat(header.length));
      lines.push(rowLine(section.totals, section.columns, widths));
    }
    lines.push("");
  }
  return lines;
}

function escapePdfText(s: string): string {
  let out = "";
  for (const ch of s) {
    const code = ch.codePointAt(0)!;
    if (ch === "(" || ch === ")" || ch === "\\") out += "\\" + ch;
    else if (code < 32) out += " ";
    else if (code < 127) out += ch;
    else if (code <= 255) out += "\\" + code.toString(8).padStart(3, "0"); // WinAnsi (£ → \243)
    else out += "?";
  }
  return out;
}

function contentStream(pageLines: string[]): string {
  const body = pageLines
    .map((l, i) => (i === 0 ? `(${escapePdfText(l)}) Tj` : `T* (${escapePdfText(l)}) Tj`))
    .join("\n");
  return `BT\n/F1 ${FONT_SIZE} Tf\n${MARGIN} ${TOP_Y} Td\n${LINE_H} TL\n${body}\nET`;
}

/** Build a valid PDF document from a report model. */
export function reportToPdf(model: ReportModel): Uint8Array {
  const lines = reportToTextLines(model);
  const pages: string[][] = [];
  for (let i = 0; i < lines.length; i += LINES_PER_PAGE) pages.push(lines.slice(i, i + LINES_PER_PAGE));
  if (pages.length === 0) pages.push([model.title]);

  // Object layout: 1 catalog, 2 pages, 3 font, then per page [pageObj, contentObj].
  const pageObjNum = (i: number) => 4 + i * 2;
  const contentObjNum = (i: number) => 5 + i * 2;
  const objects: string[] = [];

  objects[1] = `<< /Type /Catalog /Pages 2 0 R >>`;
  objects[2] = `<< /Type /Pages /Count ${pages.length} /Kids [${pages.map((_, i) => `${pageObjNum(i)} 0 R`).join(" ")}] >>`;
  objects[3] = `<< /Type /Font /Subtype /Type1 /BaseFont /Courier /Encoding /WinAnsiEncoding >>`;

  pages.forEach((pageLines, i) => {
    objects[pageObjNum(i)] =
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_W} ${PAGE_H}] ` +
      `/Resources << /Font << /F1 3 0 R >> >> /Contents ${contentObjNum(i)} 0 R >>`;
    const stream = contentStream(pageLines);
    objects[contentObjNum(i)] = `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`;
  });

  // Serialise with a cross-reference table.
  const count = objects.length - 1; // index 0 unused
  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [];
  for (let n = 1; n <= count; n++) {
    offsets[n] = pdf.length;
    pdf += `${n} 0 obj\n${objects[n]}\nendobj\n`;
  }
  const xrefStart = pdf.length;
  pdf += `xref\n0 ${count + 1}\n0000000000 65535 f \n`;
  for (let n = 1; n <= count; n++) pdf += `${String(offsets[n]).padStart(10, "0")} 00000 n \n`;
  pdf += `trailer\n<< /Size ${count + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;

  // Latin1 bytes (we only emit chars in 0–255).
  const bytes = new Uint8Array(pdf.length);
  for (let i = 0; i < pdf.length; i++) bytes[i] = pdf.charCodeAt(i) & 0xff;
  return bytes;
}
