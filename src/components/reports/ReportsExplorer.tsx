"use client";

import { useMemo, useState } from "react";
import { Card, CardHeader, Button } from "@/components/ui";
import { REPORT_DEFS, buildReport, type ReportDataset, type ReportFilters } from "@/lib/reports/build";
import { formatCell, type ReportColumn, type ReportRow, type ReportSection } from "@/lib/reports/model";

const PAGE_SIZE = 15; // paginate large ledgers

const alignOf = (c: ReportColumn) => c.align ?? (c.type === "money" || c.type === "number" ? "text-right" : "text-left");

function isNegMoney(c: ReportColumn, v: ReportRow[string]) {
  return c.type === "money" && typeof v === "number" && v < 0;
}

export function ReportsExplorer({ dataset, defaultFilters }: { dataset: ReportDataset; defaultFilters: ReportFilters }) {
  const [selectedId, setSelectedId] = useState(REPORT_DEFS[0].id);
  const [filters, setFilters] = useState<ReportFilters>(defaultFilters);

  const def = REPORT_DEFS.find((r) => r.id === selectedId)!;
  const model = useMemo(() => buildReport(dataset, selectedId, filters), [dataset, selectedId, filters]);

  // Export is rendered server-side (PDF) / streamed (CSV) via the export adapter.
  function exportUrl(format: "csv" | "pdf") {
    const q = new URLSearchParams({ type: selectedId, from: filters.from, to: filters.to, format });
    if (filters.portfolioId) q.set("portfolioId", filters.portfolioId);
    if (filters.propertyId) q.set("propertyId", filters.propertyId);
    if (filters.ownerId) q.set("ownerId", filters.ownerId);
    return `/api/reports/export?${q.toString()}`;
  }
  const exportCsv = () => window.location.assign(exportUrl("csv"));
  const exportPdf = () => window.location.assign(exportUrl("pdf"));

  return (
    <div className="flex flex-col gap-4 lg:flex-row">
      {/* Catalogue */}
      <aside className="lg:w-72 lg:shrink-0">
        <Card>
          <CardHeader title="Report types" subtitle={`${REPORT_DEFS.length} reports`} />
          <ul className="max-h-[70vh] divide-y divide-slate-100 overflow-y-auto">
            {REPORT_DEFS.map((r) => (
              <li key={r.id}>
                <button
                  onClick={() => setSelectedId(r.id)}
                  className={`w-full px-4 py-3 text-left transition ${r.id === selectedId ? "bg-brand-50" : "hover:bg-slate-50"}`}
                >
                  <p className={`text-sm font-medium ${r.id === selectedId ? "text-brand-800" : "text-slate-900"}`}>{r.name}</p>
                  <p className="mt-0.5 text-xs text-slate-500">{r.description}</p>
                </button>
              </li>
            ))}
          </ul>
        </Card>
      </aside>

      {/* Selected report */}
      <section className="min-w-0 flex-1 space-y-4">
        <Card>
          <div className="flex flex-wrap items-end justify-between gap-4 p-5">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">{model.title}</h2>
              {model.subtitle ? <p className="text-sm text-slate-500">{model.subtitle}</p> : null}
            </div>
            <div className="flex flex-wrap items-end gap-3">
              {def.filters.includes("date") ? (
                <>
                  <Field label="From"><input type="date" value={filters.from} onChange={(e) => setFilters((f) => ({ ...f, from: e.target.value }))} className="input" /></Field>
                  <Field label="To"><input type="date" value={filters.to} onChange={(e) => setFilters((f) => ({ ...f, to: e.target.value }))} className="input" /></Field>
                </>
              ) : null}
              {def.filters.includes("portfolio") ? (
                <Field label="Portfolio">
                  <select value={filters.portfolioId} onChange={(e) => setFilters((f) => ({ ...f, portfolioId: e.target.value }))} className="input">
                    <option value="">All portfolios</option>
                    {dataset.portfolios.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </Field>
              ) : null}
              <Button variant="secondary" onClick={exportCsv}>Export CSV</Button>
              <Button variant="secondary" onClick={exportPdf}>Export PDF</Button>
            </div>
          </div>
          {model.meta.length ? (
            <div className="flex flex-wrap gap-x-6 gap-y-1 border-t border-slate-100 px-5 py-3 text-xs text-slate-500">
              {model.meta.map((m) => <span key={m.label}><span className="font-medium text-slate-400">{m.label}:</span> {m.value}</span>)}
            </div>
          ) : null}
        </Card>

        {model.sections.map((section, i) => <SectionTable key={`${selectedId}-${i}`} section={section} />)}
      </section>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-xs font-medium text-slate-500">
      {label}
      {children}
    </label>
  );
}

function SectionTable({ section }: { section: ReportSection }) {
  const [page, setPage] = useState(1);
  const total = section.rows.length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const paginated = total > PAGE_SIZE;
  const visibleRows = paginated ? section.rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE) : section.rows;

  return (
    <Card>
      {section.title ? <CardHeader title={section.title} /> : null}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="border-b border-slate-100 text-xs uppercase tracking-wide text-slate-400">
              {section.columns.map((c) => <th key={c.key} className={`px-4 py-3 font-medium ${alignOf(c)}`}>{c.label}</th>)}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {section.rows.length === 0 ? (
              <tr><td colSpan={section.columns.length} className="px-4 py-8 text-center text-slate-400">{section.empty ?? "No data."}</td></tr>
            ) : (
              visibleRows.map((row, ri) => (
                <tr key={ri} className="hover:bg-slate-50">
                  {section.columns.map((c) => (
                    <td key={c.key} className={`px-4 py-2.5 ${alignOf(c)} ${isNegMoney(c, row[c.key]) ? "text-rose-600" : "text-slate-700"}`}>
                      {formatCell(row[c.key], c.type, "screen")}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
          {section.totals ? (
            <tfoot>
              <tr className="border-t border-slate-200 bg-slate-50 font-semibold text-slate-900">
                {section.columns.map((c) => (
                  <td key={c.key} className={`px-4 py-3 ${alignOf(c)} ${isNegMoney(c, section.totals![c.key]) ? "text-rose-600" : ""}`}>
                    {formatCell(section.totals![c.key], c.type, "screen")}
                  </td>
                ))}
              </tr>
            </tfoot>
          ) : null}
        </table>
      </div>
      {paginated ? (
        <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3 text-sm text-slate-500">
          <span>Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} of {total}</span>
          <div className="flex gap-2">
            <Button variant="secondary" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>Previous</Button>
            <Button variant="secondary" disabled={page >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>Next</Button>
          </div>
        </div>
      ) : null}
    </Card>
  );
}
