// Pure CSV exporter for a ReportModel. RFC-4180-ish: CRLF rows, quote any field
// containing comma/quote/newline, double internal quotes. Exposed both as a
// whole-string builder and a line generator so the server can stream large
// ledgers without buffering the entire file.

import { formatCell, type ReportModel, type ReportRow, type ReportColumn } from "./model";

function esc(field: string): string {
  return /[",\r\n]/.test(field) ? `"${field.replace(/"/g, '""')}"` : field;
}

function rowToCells(row: ReportRow, columns: ReportColumn[]): string[] {
  return columns.map((c) => formatCell(row[c.key], c.type, "csv"));
}

/** Yield the CSV one logical line at a time (each already terminated with CRLF). */
export function* reportToCsvLines(model: ReportModel): Generator<string> {
  yield esc(model.title) + "\r\n";
  if (model.subtitle) yield esc(model.subtitle) + "\r\n";
  for (const m of model.meta) yield `${esc(m.label)},${esc(m.value)}\r\n`;
  yield "\r\n";

  for (const section of model.sections) {
    if (section.title) yield esc(section.title) + "\r\n";
    yield section.columns.map((c) => esc(c.label)).join(",") + "\r\n";
    for (const row of section.rows) yield rowToCells(row, section.columns).map(esc).join(",") + "\r\n";
    if (section.rows.length === 0 && section.empty) yield esc(section.empty) + "\r\n";
    if (section.totals) yield rowToCells(section.totals, section.columns).map(esc).join(",") + "\r\n";
    yield "\r\n";
  }
}

export function reportToCsv(model: ReportModel): string {
  let out = "";
  for (const line of reportToCsvLines(model)) out += line;
  return out.replace(/\r\n$/, ""); // drop the trailing newline
}
