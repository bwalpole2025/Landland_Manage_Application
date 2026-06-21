// Shared report model. Every report — whatever its source data — is reduced to
// this shape, which the on-screen tables, the CSV exporter and the PDF exporter
// all consume. One source of truth, three renderings.

import { formatGBP } from "@/lib/money";
import { formatDate } from "@/lib/dates";

export type CellType = "text" | "money" | "date" | "number";

export interface ReportColumn {
  key: string;
  label: string;
  type: CellType;
  align?: "left" | "right";
}

export type ReportCell = string | number | null | undefined;
export type ReportRow = Record<string, ReportCell>;

export interface ReportSection {
  title?: string;
  columns: ReportColumn[];
  rows: ReportRow[];
  /** Optional totals row, keyed by column. */
  totals?: ReportRow;
  /** Message shown when there are no rows. */
  empty?: string;
}

export interface ReportMeta {
  label: string;
  value: string;
}

export interface ReportModel {
  id: string;
  title: string;
  subtitle?: string;
  meta: ReportMeta[];
  sections: ReportSection[];
}

export type RenderMode = "screen" | "csv" | "pdf";

/** Format a single cell for a given output. Money cells carry raw pence. */
export function formatCell(value: ReportCell, type: CellType, mode: RenderMode): string {
  if (value === null || value === undefined || value === "") return "";
  switch (type) {
    case "money": {
      const pence = Number(value);
      if (mode === "csv") return (pence / 100).toFixed(2);
      // screen + pdf: grouped pounds, negatives in parentheses.
      const s = formatGBP(Math.abs(pence), { showPence: mode === "pdf" });
      return pence < 0 ? `(${s})` : s;
    }
    case "date":
      return mode === "csv" ? String(value) : formatDate(String(value));
    case "number":
    case "text":
    default:
      return String(value);
  }
}
