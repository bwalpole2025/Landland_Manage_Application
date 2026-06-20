"use client";

import { useMemo, useState } from "react";
import { Modal } from "@/components/ds/Modal";
import { Button, Badge } from "@/components/ui";
import { formatGBP } from "@/lib/money";
import { categoryLabel } from "@/lib/sa105";
import {
  parseCsv,
  autoMap,
  validateImport,
  resetImportSeq,
  IMPORT_FIELDS,
  CSV_TEMPLATE,
  SAMPLE_CSV,
  type ColumnMap,
  type ValidationResult,
} from "@/lib/import/csv";
import type { Transaction } from "@/lib/types";

type Step = "upload" | "map" | "preview" | "done";

export function ImportWizardModal({
  open,
  onClose,
  onImport,
  existing,
  properties,
}: {
  open: boolean;
  onClose: () => void;
  onImport: (rows: Transaction[]) => void;
  existing: Transaction[];
  properties: { id: string; nickname: string }[];
}) {
  const [step, setStep] = useState<Step>("upload");
  const [fileName, setFileName] = useState<string | null>(null);
  const [parsed, setParsed] = useState<{ headers: string[]; rows: string[][] } | null>(null);
  const [map, setMap] = useState<ColumnMap>({});
  const [notes, setNotes] = useState<Record<number, string>>({});
  const [committed, setCommitted] = useState(0);

  function loadText(text: string, name: string) {
    const p = parseCsv(text);
    setParsed(p);
    setMap(autoMap(p.headers));
    setFileName(name);
    setStep("map");
  }

  function onFile(file: File) {
    if (/\.xlsx?$/i.test(file.name)) {
      // XLSX would be parsed with SheetJS in production; for the demo, ask for CSV.
      alert("Please export your spreadsheet as CSV and upload that. (XLSX parsing uses SheetJS in production.)");
      return;
    }
    file.text().then((t) => loadText(t, file.name));
  }

  const validation: ValidationResult | null = useMemo(() => {
    if (step !== "preview" || !parsed) return null;
    resetImportSeq();
    return validateImport(parsed.rows, map, {
      existing,
      properties,
    });
  }, [step, parsed, map, existing, properties]);

  function commit() {
    if (!validation) return;
    const rows = validation.results
      .filter((r) => r.status === "ok" && r.transaction)
      .map((r) => ({ ...r.transaction!, notes: notes[r.rowIndex] || r.transaction!.notes }));
    onImport(rows);
    setCommitted(rows.length);
    setStep("done");
  }

  function close() {
    setStep("upload");
    setParsed(null);
    setMap({});
    setFileName(null);
    setNotes({});
    setCommitted(0);
    onClose();
  }

  function downloadTemplate() {
    const url = URL.createObjectURL(new Blob([CSV_TEMPLATE], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "landland-import-template.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  const requiredMapped = IMPORT_FIELDS.filter((f) => f.required).every((f) => map[f.key] != null);

  return (
    <Modal open={open} onClose={close} title="Import a spreadsheet" size="lg">
      {step === "upload" ? (
        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            Upload a CSV of your rental income &amp; expenses. We&apos;ll map the columns, then let you
            preview and fix any issues before anything is added.
          </p>
          <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-300 px-6 py-8 text-center transition hover:border-brand-400 hover:bg-brand-50/40">
            <span className="text-2xl">📄</span>
            <span className="text-sm font-medium text-slate-700">Choose a .csv file</span>
            <input type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
          </label>
          <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
            <button onClick={downloadTemplate} className="font-medium text-brand-700 hover:text-brand-800">⬇ Download CSV template</button>
            <button onClick={() => loadText(SAMPLE_CSV, "sample.csv")} className="font-medium text-brand-700 hover:text-brand-800">Try a sample CSV →</button>
          </div>
        </div>
      ) : null}

      {step === "map" && parsed ? (
        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            Map each field to a column from <span className="font-medium">{fileName}</span>. Required
            fields are marked.
          </p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {IMPORT_FIELDS.map((f) => (
              <label key={f.key} className="block">
                <span className="mb-1 block text-sm font-medium text-slate-700">
                  {f.label}{f.required ? <span className="text-red-500"> *</span> : null}
                </span>
                <select
                  className="h-10 w-full appearance-none rounded-lg border border-slate-300 px-3 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
                  value={map[f.key] ?? ""}
                  onChange={(e) => setMap((m) => ({ ...m, [f.key]: e.target.value === "" ? undefined : Number(e.target.value) }))}
                >
                  <option value="">— Not mapped —</option>
                  {parsed.headers.map((h, i) => <option key={i} value={i}>{h || `Column ${i + 1}`}</option>)}
                </select>
              </label>
            ))}
          </div>
          <div className="flex items-center justify-between">
            <Button variant="secondary" onClick={() => setStep("upload")}>Back</Button>
            <Button onClick={() => setStep("preview")} disabled={!requiredMapped}>Preview &amp; validate</Button>
          </div>
          {!requiredMapped ? <p className="text-xs text-amber-600">Map all required fields (Date, Description, Amount) to continue.</p> : null}
        </div>
      ) : null}

      {step === "preview" && validation ? (
        <div className="space-y-4">
          {/* Validation summary */}
          <div className="flex flex-wrap gap-2">
            <Badge tone="neutral">{validation.summary.total} rows</Badge>
            <Badge tone="success">{validation.summary.valid} to import</Badge>
            <Badge tone="warning">{validation.summary.duplicates} duplicate{validation.summary.duplicates === 1 ? "" : "s"}</Badge>
            <Badge tone="danger">{validation.summary.errors} error{validation.summary.errors === 1 ? "" : "s"}</Badge>
          </div>

          <div className="max-h-80 overflow-auto rounded-lg border border-slate-200">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-400">
                <tr>
                  <th className="px-3 py-2 font-medium">Row</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                  <th className="px-3 py-2 font-medium">Description</th>
                  <th className="px-3 py-2 font-medium">Category / property</th>
                  <th className="px-3 py-2 font-medium">Notes</th>
                  <th className="px-3 py-2 text-right font-medium">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {validation.results.map((r) => (
                  <tr key={r.rowIndex} className={r.status === "error" ? "bg-red-50/40" : r.status === "duplicate" ? "bg-amber-50/40" : ""}>
                    <td className="px-3 py-2 text-slate-400">{r.rowIndex}</td>
                    <td className="px-3 py-2">
                      <Badge tone={r.status === "ok" ? "success" : r.status === "duplicate" ? "warning" : "danger"}>
                        {r.status === "ok" ? "Import" : r.status === "duplicate" ? "Duplicate" : "Error"}
                      </Badge>
                    </td>
                    <td className="px-3 py-2">
                      <span className="text-slate-800">{r.transaction?.description ?? r.cells.join(" · ")}</span>
                      {r.errors.length ? (
                        <ul className="mt-0.5 text-xs text-red-600">
                          {r.errors.map((e, i) => <li key={i}>{e.field}: {e.message}</li>)}
                        </ul>
                      ) : null}
                    </td>
                    <td className="px-3 py-2 text-slate-500">
                      {r.transaction?.category ? categoryLabel(r.transaction.category) : "—"}
                      {r.transaction?.propertyId ? <span className="block text-xs text-slate-400">{properties.find((p) => p.id === r.transaction!.propertyId)?.nickname}</span> : null}
                    </td>
                    <td className="px-3 py-2">
                      {r.status === "ok" ? (
                        <input
                          className="h-8 w-full rounded border border-slate-200 px-2 text-xs outline-none focus:border-brand-400"
                          placeholder="add note…"
                          defaultValue={r.transaction?.notes ?? ""}
                          onChange={(e) => setNotes((n) => ({ ...n, [r.rowIndex]: e.target.value }))}
                        />
                      ) : "—"}
                    </td>
                    <td className="px-3 py-2 text-right font-medium text-slate-700">{r.transaction ? formatGBP(r.transaction.amountPence) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between">
            <Button variant="secondary" onClick={() => setStep("map")}>Back</Button>
            <Button onClick={commit} disabled={validation.summary.valid === 0}>
              Import {validation.summary.valid} transaction{validation.summary.valid === 1 ? "" : "s"}
            </Button>
          </div>
        </div>
      ) : null}

      {step === "done" ? (
        <div className="space-y-3 py-2 text-center">
          <p className="text-3xl">✅</p>
          <p className="text-sm font-medium text-slate-900">Imported {committed} transaction{committed === 1 ? "" : "s"}</p>
          <p className="text-sm text-slate-500">They&apos;re in your ledger now — categorise and reconcile as needed.</p>
          <Button onClick={close}>Done</Button>
        </div>
      ) : null}
    </Modal>
  );
}
