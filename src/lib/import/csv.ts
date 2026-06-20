// Spreadsheet (CSV) import: parse → map columns → validate (row-level) → dedupe.
// Pure and framework-free so it's unit-testable; the UI wires it into a wizard.

import type { Transaction, TransactionCategory, TransactionDirection } from "@/lib/types";
import { CATEGORY_OPTIONS } from "@/lib/categorisation";
import { dedupeKey } from "@/lib/ingest";

export type ImportField = "date" | "description" | "amount" | "direction" | "category" | "property" | "notes" | "receipt";

export interface FieldDef {
  key: ImportField;
  label: string;
  required: boolean;
  aliases: string[];
}

export const IMPORT_FIELDS: FieldDef[] = [
  { key: "date", label: "Date", required: true, aliases: ["date", "transaction date", "posted"] },
  { key: "description", label: "Description", required: true, aliases: ["description", "details", "narrative", "payee", "reference"] },
  { key: "amount", label: "Amount", required: true, aliases: ["amount", "value", "gbp", "£"] },
  { key: "direction", label: "Direction", required: false, aliases: ["direction", "type", "in/out", "debit/credit"] },
  { key: "category", label: "Category", required: false, aliases: ["category", "sa105", "tax category"] },
  { key: "property", label: "Property", required: false, aliases: ["property", "address", "unit"] },
  { key: "notes", label: "Notes", required: false, aliases: ["notes", "memo", "comment"] },
  { key: "receipt", label: "Receipt", required: false, aliases: ["receipt", "attachment", "document"] },
];

export type ColumnMap = Partial<Record<ImportField, number>>;

export interface RowError {
  field: ImportField | "row";
  message: string;
}
export interface RowResult {
  rowIndex: number; // 1-based, excludes the header
  cells: string[];
  status: "ok" | "duplicate" | "error";
  transaction?: Transaction;
  errors: RowError[];
}
export interface ImportSummary {
  total: number;
  valid: number;
  duplicates: number;
  errors: number;
}
export interface ValidationResult {
  results: RowResult[];
  summary: ImportSummary;
}

export interface ImportContext {
  existing: Pick<Transaction, "date" | "amountPence" | "direction" | "description">[];
  properties: { id: string; nickname: string }[];
}

// --- Parsing -----------------------------------------------------------------

/** Minimal RFC-4180-ish CSV parser (handles quotes, embedded commas/quotes). */
export function parseCsv(text: string): { headers: string[]; rows: string[][] } {
  const records: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;
  const src = text.replace(/\r\n?/g, "\n");

  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (inQuotes) {
      if (c === '"') {
        if (src[i + 1] === '"') { cell += '"'; i++; }
        else inQuotes = false;
      } else cell += c;
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      row.push(cell); cell = "";
    } else if (c === "\n") {
      row.push(cell); records.push(row); row = []; cell = "";
    } else {
      cell += c;
    }
  }
  if (cell.length || row.length) { row.push(cell); records.push(row); }

  const nonEmpty = records.filter((r) => r.some((v) => v.trim() !== ""));
  const [headers = [], ...rows] = nonEmpty;
  return { headers: headers.map((h) => h.trim()), rows };
}

/** Best-effort header → field mapping by alias matching. */
export function autoMap(headers: string[]): ColumnMap {
  const map: ColumnMap = {};
  headers.forEach((h, i) => {
    const norm = h.toLowerCase().trim();
    for (const f of IMPORT_FIELDS) {
      if (map[f.key] != null) continue;
      if (f.aliases.some((a) => norm === a || norm.includes(a))) map[f.key] = i;
    }
  });
  return map;
}

// --- Validation --------------------------------------------------------------

function parseDate(raw: string): string | null {
  const s = raw.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return isValidDate(s) ? s : null;
  const uk = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/); // DD/MM/YYYY
  if (uk) {
    const iso = `${uk[3]}-${uk[2].padStart(2, "0")}-${uk[1].padStart(2, "0")}`;
    return isValidDate(iso) ? iso : null;
  }
  return null;
}
function isValidDate(iso: string): boolean {
  const d = new Date(`${iso}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === iso;
}

function parseAmount(raw: string): number | null {
  const cleaned = raw.replace(/[£$,\s]/g, "");
  if (cleaned === "" || !/^-?\d+(\.\d+)?$/.test(cleaned)) return null;
  return Math.round(Number(cleaned) * 100);
}

function resolveCategory(raw: string): { category: TransactionCategory; subcategory?: string } | null {
  const s = raw.trim().toLowerCase();
  const opt =
    CATEGORY_OPTIONS.find((o) => o.label.toLowerCase() === s) ||
    CATEGORY_OPTIONS.find((o) => o.value === s) ||
    CATEGORY_OPTIONS.find((o) => o.category === s);
  return opt ? { category: opt.category, subcategory: opt.subcategory } : null;
}

let importSeq = 0;
export function resetImportSeq(): void {
  importSeq = 0;
}

export function validateImport(rows: string[][], map: ColumnMap, ctx: ImportContext): ValidationResult {
  const seenInBatch = new Set<string>();
  const existingKeys = new Set(ctx.existing.map(dedupeKey));
  const results: RowResult[] = [];

  rows.forEach((cells, idx) => {
    const errors: RowError[] = [];
    const get = (f: ImportField) => (map[f] != null ? (cells[map[f]!] ?? "").trim() : "");

    // Date
    const dateRaw = get("date");
    const date = parseDate(dateRaw);
    if (!dateRaw) errors.push({ field: "date", message: "Date is required" });
    else if (!date) errors.push({ field: "date", message: `Unrecognised date "${dateRaw}" (use YYYY-MM-DD or DD/MM/YYYY)` });

    // Description
    const description = get("description");
    if (!description) errors.push({ field: "description", message: "Description is required" });

    // Amount
    const amountRaw = get("amount");
    const amountSigned = parseAmount(amountRaw);
    if (!amountRaw) errors.push({ field: "amount", message: "Amount is required" });
    else if (amountSigned == null) errors.push({ field: "amount", message: `"${amountRaw}" is not a valid amount` });
    else if (amountSigned === 0) errors.push({ field: "amount", message: "Amount must be non-zero" });

    // Direction — from a column, else inferred from the amount's sign.
    let direction: TransactionDirection | null = null;
    const dirRaw = get("direction").toLowerCase();
    if (dirRaw) {
      if (/^(income|in|credit|cr|\+)/.test(dirRaw)) direction = "income";
      else if (/^(expense|out|debit|dr|-)/.test(dirRaw)) direction = "expense";
      else errors.push({ field: "direction", message: `Unrecognised direction "${dirRaw}"` });
    } else if (amountSigned != null) {
      direction = amountSigned < 0 ? "expense" : "income";
    }

    // Category (optional)
    const catRaw = get("category");
    let category: TransactionCategory | undefined;
    let subcategory: string | undefined;
    if (catRaw) {
      const resolved = resolveCategory(catRaw);
      if (!resolved) errors.push({ field: "category", message: `Unknown category "${catRaw}"` });
      else { category = resolved.category; subcategory = resolved.subcategory; }
    }

    // Property (optional)
    const propRaw = get("property");
    let propertyId: string | undefined;
    if (propRaw) {
      const p = ctx.properties.find((x) => x.nickname.toLowerCase() === propRaw.toLowerCase());
      if (!p) errors.push({ field: "property", message: `Unknown property "${propRaw}"` });
      else propertyId = p.id;
    }

    if (errors.length) {
      results.push({ rowIndex: idx + 1, cells, status: "error", errors });
      return;
    }

    const tx: Transaction = {
      id: `txn_import_${++importSeq}`,
      accountId: "acc_1",
      date: date!,
      direction: direction!,
      amountPence: Math.abs(amountSigned!),
      description,
      category,
      subcategory,
      propertyId,
      notes: get("notes") || undefined,
      receiptRef: get("receipt") || undefined,
      source: "manual",
      reconcile: "unreconciled",
    };

    const key = dedupeKey(tx);
    if (existingKeys.has(key) || seenInBatch.has(key)) {
      results.push({ rowIndex: idx + 1, cells, status: "duplicate", transaction: tx, errors: [] });
      return;
    }
    seenInBatch.add(key);
    results.push({ rowIndex: idx + 1, cells, status: "ok", transaction: tx, errors: [] });
  });

  const summary: ImportSummary = {
    total: results.length,
    valid: results.filter((r) => r.status === "ok").length,
    duplicates: results.filter((r) => r.status === "duplicate").length,
    errors: results.filter((r) => r.status === "error").length,
  };
  return { results, summary };
}

// --- Template + sample -------------------------------------------------------

export const CSV_TEMPLATE_HEADERS = "Date,Description,Amount,Direction,Category,Property,Notes";

export const CSV_TEMPLATE = `${CSV_TEMPLATE_HEADERS}
2026-04-06,Rent — A Tenant,1250.00,income,Rent received,Oakfield Road,
2026-04-10,Boiler repair,180.00,expense,Repairs & maintenance,Oakfield Road,Annual service
`;

// A deliberately mixed sample: valid rows, one duplicate of seeded data, and
// two error rows — so the validation summary is non-trivial.
export const SAMPLE_CSV = `${CSV_TEMPLATE_HEADERS}
2026-06-25,Rent — J Fletcher,1250.00,income,Rent received,Oakfield Road,July rent (early)
2026-06-26,B&Q materials,84.30,expense,Repairs & maintenance,Oakfield Road,Bathroom sealant
2026-06-27,Landlord insurance renewal,310.00,expense,Insurance,Station Mews,
2026-06-01,Rent — J Fletcher,1250.00,income,Rent received,Oakfield Road,
2026-06-28,Mystery payment,notanumber,expense,,,
2026-06-29,Service charge,95.00,expense,Totally Unknown Category,Harbourside,
`;
