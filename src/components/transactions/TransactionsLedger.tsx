"use client";

import { useEffect, useMemo, useState, type Dispatch, type SetStateAction } from "react";
import Link from "next/link";
import { Modal } from "@/components/ds/Modal";
import { Badge, Button } from "@/components/ui";
import { DownloadIcon, UnlinkIcon, PlusIcon, AlertIcon, CheckIcon } from "@/components/icons";
import { formatGBP, poundsToPence } from "@/lib/money";
import { formatDate } from "@/lib/dates";
import { categoryLabel } from "@/lib/sa105";
import { computeArrears } from "@/lib/arrears";
import {
  optionsForDirection,
  resolveOption,
  optionValueFor,
  suggestCategorisation,
  type SuggestContext,
} from "@/lib/categorisation";
import { filterTransactions, hasActiveFilters, type TxFilters } from "@/lib/transactions-filter";
import type { ReconcileStatus, Tenancy, Transaction } from "@/lib/types";

export interface LedgerOption {
  id: string;
  label: string;
}

const reconcileTone: Record<ReconcileStatus, "success" | "warning" | "neutral"> = {
  reconciled: "success",
  unreconciled: "warning",
  ignored: "neutral",
};
const reconcileLabel: Record<ReconcileStatus, string> = {
  reconciled: "Reconciled",
  unreconciled: "Needs review",
  ignored: "Ignored",
};

const selectClass =
  "h-10 appearance-none rounded-lg border border-slate-300 bg-white pl-3 pr-8 text-sm text-slate-900 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100";

export interface LedgerProps {
  rows: Transaction[];
  setRows: Dispatch<SetStateAction<Transaction[]>>;
  propertyNames: Record<string, string>;
  tenancyNames: Record<string, string>;
  properties: LedgerOption[];
  tenancies: LedgerOption[];
  bankAccounts: LedgerOption[];
  activeTenancies: Tenancy[];
  /** propertyId → its active tenancy id, for auto-linking rent. */
  activeTenancyByProperty: Record<string, string>;
  suggestContext: SuggestContext;
}

export function TransactionsLedger(props: LedgerProps) {
  const { rows, setRows, propertyNames, tenancyNames, properties, tenancies, bankAccounts } = props;
  const [filters, setFilters] = useState<TxFilters>({});
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [showDeactivated, setShowDeactivated] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [editing, setEditing] = useState<Transaction | null>(null);
  const [bulkCatOpen, setBulkCatOpen] = useState(false);
  const [suggestOpen, setSuggestOpen] = useState(false);

  const visible = useMemo(() => {
    const f = filterTransactions(rows, filters);
    return showDeactivated ? f : f.filter((t) => !t.deactivated);
  }, [rows, filters, showDeactivated]);

  const active = hasActiveFilters(filters);

  // Live arrears, recomputed from the current (active) rows — categorising a
  // rent payment and linking its tenancy clears the entry here immediately.
  const activeRows = useMemo(() => rows.filter((t) => !t.deactivated), [rows]);
  const arrears = useMemo(
    () =>
      props.activeTenancies
        .map((t) => ({ tenancy: t, a: computeArrears(t, activeRows) }))
        .filter((x) => x.a.status === "in_arrears"),
    [props.activeTenancies, activeRows],
  );

  const placeValue = filters.propertyId ? `prop:${filters.propertyId}` : filters.tenancyId ? `ten:${filters.tenancyId}` : "";
  function setPlace(value: string) {
    if (!value) return setFilters((f) => ({ ...f, propertyId: undefined, tenancyId: undefined }));
    const [kind, id] = value.split(":");
    setFilters((f) => ({ ...f, propertyId: kind === "prop" ? id : undefined, tenancyId: kind === "ten" ? id : undefined }));
  }

  function toggleSelected(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function patchRows(ids: Set<string> | string[], patch: (t: Transaction) => Transaction) {
    const idSet = ids instanceof Set ? ids : new Set(ids);
    setRows((prev) => prev.map((t) => (idSet.has(t.id) ? patch(t) : t)));
  }

  function bulkUnlink() {
    patchRows(selected, (t) => ({ ...t, propertyId: undefined, tenancyId: undefined }));
    setSelected(new Set());
  }

  function applyEdit(updated: Transaction) {
    setRows((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
    setEditing(null);
  }

  function downloadCsv() {
    const header = ["Date", "Description", "Property", "Category", "Subcategory", "Direction", "Amount (£)", "Status"];
    const lines = visible.map((t) =>
      [
        t.date,
        `"${t.description.replace(/"/g, '""')}"`,
        t.propertyId ? propertyNames[t.propertyId] ?? "" : "Default portfolio",
        t.category ? categoryLabel(t.category) : "",
        t.subcategory ?? "",
        t.direction,
        (t.amountPence / 100).toFixed(2),
        t.deactivated ? "excluded" : t.reconcile,
      ].join(","),
    );
    const csv = [header.join(","), ...lines].join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "transactions.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  const uncategorisedSelected = [...selected].filter((id) => !rows.find((t) => t.id === id)?.category);
  const suggestTargets = selected.size ? rows.filter((t) => selected.has(t.id) && !t.category) : visible.filter((t) => !t.category);

  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
      {/* Filter bar */}
      <div className="flex flex-wrap items-end gap-2 border-b border-slate-100 p-4">
        <select aria-label="Bank feed / account" className={selectClass} value={filters.source ?? ""} onChange={(e) => setFilters((f) => ({ ...f, source: e.target.value || undefined }))}>
          <option value="">All accounts</option>
          {bankAccounts.map((b) => <option key={b.id} value={b.id}>{b.label}</option>)}
          <option value="manual">Manual entries</option>
        </select>

        <select aria-label="Properties / Tenants" className={selectClass} value={placeValue} onChange={(e) => setPlace(e.target.value)}>
          <option value="">All properties &amp; tenants</option>
          <optgroup label="Properties">
            {properties.map((p) => <option key={p.id} value={`prop:${p.id}`}>{p.label}</option>)}
          </optgroup>
          <optgroup label="Tenants">
            {tenancies.map((t) => <option key={t.id} value={`ten:${t.id}`}>{t.label}</option>)}
          </optgroup>
        </select>

        <select aria-label="Transaction type" className={selectClass} value={filters.type ?? ""} onChange={(e) => setFilters((f) => ({ ...f, type: (e.target.value || undefined) as TxFilters["type"] }))}>
          <option value="">All types</option>
          <option value="income">Income</option>
          <option value="expense">Expense</option>
        </select>

        <select aria-label="Category" className={selectClass} value={filters.category ?? ""} onChange={(e) => setFilters((f) => ({ ...f, category: (e.target.value || undefined) as TxFilters["category"] }))}>
          <option value="">All categories</option>
          {optionsForDirection("income").concat(optionsForDirection("expense")).map((o) => (
            <option key={o.value} value={o.category}>{o.label}</option>
          ))}
        </select>

        <div className="flex items-center gap-1.5">
          <span className="text-sm text-slate-400">£</span>
          <input aria-label="Minimum amount" type="number" min={0} placeholder="min" className="h-10 w-20 rounded-lg border border-slate-300 px-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100" value={filters.minPence != null ? String(filters.minPence / 100) : ""} onChange={(e) => setFilters((f) => ({ ...f, minPence: e.target.value ? poundsToPence(Number(e.target.value)) : undefined }))} />
          <span className="text-sm text-slate-400">to £</span>
          <input aria-label="Maximum amount" type="number" min={0} placeholder="max" className="h-10 w-20 rounded-lg border border-slate-300 px-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100" value={filters.maxPence != null ? String(filters.maxPence / 100) : ""} onChange={(e) => setFilters((f) => ({ ...f, maxPence: e.target.value ? poundsToPence(Number(e.target.value)) : undefined }))} />
        </div>

        <label className="flex h-10 items-center gap-1.5 px-1 text-sm text-slate-600">
          <input type="checkbox" className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500" checked={showDeactivated} onChange={(e) => setShowDeactivated(e.target.checked)} />
          Show deactivated
        </label>

        {active ? <button onClick={() => setFilters({})} className="h-10 px-2 text-sm font-medium text-brand-700 hover:text-brand-800">Clear filters</button> : null}
      </div>

      {/* Live arrears indicator (recomputes as you categorise) */}
      <div className={`flex items-center gap-2 px-4 py-2 text-sm ${arrears.length ? "bg-amber-50 text-amber-800" : "bg-emerald-50 text-emerald-800"}`}>
        {arrears.length ? (
          <>
            <AlertIcon width={16} height={16} className="shrink-0 text-amber-500" />
            <span>
              {arrears.length} {arrears.length === 1 ? "tenancy" : "tenancies"} in arrears:{" "}
              {arrears.map((x) => propertyNames[x.tenancy.propertyId] ?? "Property").join(", ")}
            </span>
          </>
        ) : (
          <>
            <CheckIcon width={16} height={16} className="shrink-0 text-emerald-600" />
            <span>All rent up to date.</span>
          </>
        )}
      </div>

      {/* Action bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-2.5">
        <p className="text-sm text-slate-500">
          {visible.length} of {rows.length} transaction{rows.length === 1 ? "" : "s"}
          {selected.size > 0 ? ` · ${selected.size} selected` : ""}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="ghost" onClick={() => setSuggestOpen(true)} disabled={suggestTargets.length === 0} title="Propose categories from the payee">Auto-suggest</Button>
          <Button variant="ghost" onClick={() => setBulkCatOpen(true)} disabled={selected.size === 0}>Recategorise</Button>
          <Button variant="ghost" onClick={bulkUnlink} disabled={selected.size === 0} title="Detach selected from their property/tenancy"><UnlinkIcon width={16} height={16} /> Unlink</Button>
          <Button variant="ghost" onClick={downloadCsv}><DownloadIcon width={16} height={16} /> Download</Button>
          <Button onClick={() => setAddOpen(true)}><PlusIcon width={16} height={16} /> Add transaction</Button>
        </div>
      </div>

      {/* Ledger */}
      {visible.length === 0 ? (
        <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
          <span className="text-5xl" role="img" aria-label="detective">🕵️</span>
          <p className="mt-3 text-sm font-medium text-slate-900">Nothing to show</p>
          <p className="mt-1 text-sm text-slate-500">{active ? "No transactions match these filters." : "No transactions yet."}</p>
          {active ? <button onClick={() => setFilters({})} className="mt-3 text-sm font-medium text-brand-700 hover:text-brand-800">Clear filters</button> : null}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-400">
                <th className="w-10 px-4 py-3"></th>
                <th className="px-4 py-3 font-medium">Date</th>
                <th className="px-4 py-3 font-medium">Description</th>
                <th className="px-4 py-3 font-medium">Property / tenancy</th>
                <th className="px-4 py-3 font-medium">Category</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 text-right font-medium">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {visible.map((t) => (
                <tr key={t.id} className={`${selected.has(t.id) ? "bg-brand-50/50" : "hover:bg-slate-50"} ${t.deactivated ? "opacity-50" : ""}`}>
                  <td className="px-4 py-3">
                    <input type="checkbox" aria-label={`Select ${t.description}`} className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500" checked={selected.has(t.id)} onChange={() => toggleSelected(t.id)} />
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-slate-600">{formatDate(t.date)}</td>
                  <td className="px-4 py-3">
                    <button onClick={() => setEditing(t)} className="text-left font-medium text-slate-900 hover:text-brand-700">
                      {t.description}
                    </button>
                    <span className="ml-2 inline-flex gap-1 align-middle text-xs text-slate-400">
                      {t.receiptRef ? <span title="Receipt attached">📎</span> : null}
                      {t.notes ? <span title="Has notes">📝</span> : null}
                      {t.deactivated ? <Badge tone="neutral">Excluded</Badge> : null}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {t.propertyId ? (
                      <span>
                        <Link href={`/properties/${t.propertyId}`} className="font-medium text-brand-700 hover:text-brand-800">{propertyNames[t.propertyId] ?? "Property"}</Link>
                        {t.tenancyId ? <span className="block text-xs text-slate-400">{tenancyNames[t.tenancyId] ?? ""}</span> : null}
                      </span>
                    ) : (
                      <span className="text-slate-400">Default portfolio</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {t.category ? (
                      <button onClick={() => setEditing(t)} className="text-left hover:text-brand-700">
                        {categoryLabel(t.category)}
                        {t.subcategory ? <span className="block text-xs text-slate-400">{t.subcategory}</span> : null}
                      </button>
                    ) : (
                      <button onClick={() => setEditing(t)} className="rounded-full bg-brand-50 px-2.5 py-1 text-xs font-semibold text-brand-700 ring-1 ring-inset ring-brand-200 hover:bg-brand-100">Categorise</button>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <Badge tone={t.deactivated ? "neutral" : reconcileTone[t.reconcile]}>{t.deactivated ? "Excluded" : reconcileLabel[t.reconcile]}</Badge>
                  </td>
                  <td className={`whitespace-nowrap px-4 py-3 text-right font-semibold ${t.direction === "income" ? "text-emerald-600" : "text-slate-700"}`}>
                    {t.direction === "income" ? "+" : "−"}{formatGBP(t.amountPence)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <AddTransactionModal open={addOpen} onClose={() => setAddOpen(false)} onAdd={(t) => { setRows((p) => [t, ...p]); setAddOpen(false); }} properties={properties} />

      {editing ? (
        <CategoriseModal
          tx={editing}
          properties={properties}
          tenancyNames={tenancyNames}
          activeTenancyByProperty={props.activeTenancyByProperty}
          suggestContext={props.suggestContext}
          onClose={() => setEditing(null)}
          onSave={applyEdit}
        />
      ) : null}

      <BulkRecategoriseModal
        open={bulkCatOpen}
        count={selected.size}
        onClose={() => setBulkCatOpen(false)}
        onApply={(optionValue) => {
          const opt = resolveOption(optionValue);
          if (opt) patchRows(selected, (t) => ({ ...t, category: opt.category, subcategory: opt.subcategory }));
          setBulkCatOpen(false);
          setSelected(new Set());
        }}
      />

      <AutoSuggestModal
        open={suggestOpen}
        targets={suggestTargets}
        suggestContext={props.suggestContext}
        propertyNames={propertyNames}
        activeTenancyByProperty={props.activeTenancyByProperty}
        onClose={() => setSuggestOpen(false)}
        onApply={(applied) => {
          setRows((prev) => prev.map((t) => applied[t.id] ?? t));
          setSuggestOpen(false);
          setSelected(new Set());
        }}
      />
    </div>
  );
}

const field = "h-10 w-full appearance-none rounded-lg border border-slate-300 px-3 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100";
const fieldLabel = "mb-1 block text-sm font-medium text-slate-700";

// --- Categorise / link / receipt / notes / reconcile / deactivate -----------

function CategoriseModal({
  tx,
  properties,
  tenancyNames,
  activeTenancyByProperty,
  suggestContext,
  onClose,
  onSave,
}: {
  tx: Transaction;
  properties: LedgerOption[];
  tenancyNames: Record<string, string>;
  activeTenancyByProperty: Record<string, string>;
  suggestContext: SuggestContext;
  onClose: () => void;
  onSave: (t: Transaction) => void;
}) {
  const [optionValue, setOptionValue] = useState(optionValueFor(tx));
  const [propertyId, setPropertyId] = useState(tx.propertyId ?? "");
  const [tenancyId, setTenancyId] = useState(tx.tenancyId ?? "");
  const [notes, setNotes] = useState(tx.notes ?? "");
  const [receiptRef, setReceiptRef] = useState(tx.receiptRef ?? "");
  const [reconciled, setReconciled] = useState(tx.reconcile === "reconciled");
  const [deactivated, setDeactivated] = useState(Boolean(tx.deactivated));
  const [suggestNote, setSuggestNote] = useState<string | null>(null);

  const opts = optionsForDirection(tx.direction);
  const resolved = resolveOption(optionValue);

  // Auto-link rent to the property's active tenancy.
  useEffect(() => {
    if (resolved?.category === "rent" && propertyId && activeTenancyByProperty[propertyId]) {
      setTenancyId(activeTenancyByProperty[propertyId]);
    }
  }, [optionValue, propertyId, resolved?.category, activeTenancyByProperty]);

  function autoSuggest() {
    const s = suggestCategorisation(tx, suggestContext);
    if (!s) return;
    setOptionValue(s.optionValue);
    if (s.propertyId) setPropertyId(s.propertyId);
    if (s.tenancyId) setTenancyId(s.tenancyId);
    setSuggestNote(s.reason);
  }

  function save() {
    const opt = resolveOption(optionValue);
    onSave({
      ...tx,
      category: opt?.category,
      subcategory: opt?.subcategory,
      propertyId: propertyId || undefined,
      tenancyId: tenancyId || undefined,
      notes: notes.trim() || undefined,
      receiptRef: receiptRef || undefined,
      reconcile: deactivated ? "ignored" : reconciled ? "reconciled" : "unreconciled",
      deactivated: deactivated || undefined,
    });
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Categorise transaction"
      description={`${tx.description} · ${formatGBP(tx.amountPence)} · ${formatDate(tx.date)}`}
      size="md"
      footer={
        <div className="flex w-full items-center justify-between gap-2">
          <button onClick={() => setDeactivated((d) => !d)} className="text-sm font-medium text-slate-500 hover:text-slate-700">
            {deactivated ? "Reactivate" : "Deactivate / exclude"}
          </button>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={onClose}>Cancel</Button>
            <Button onClick={save}>Save</Button>
          </div>
        </div>
      }
    >
      <div className="mb-3 flex justify-end">
        <button onClick={autoSuggest} className="rounded-pill bg-brand-50 px-3 py-1.5 text-sm font-medium text-brand-700 ring-1 ring-inset ring-brand-200 hover:bg-brand-100">
          ✨ Auto-suggest
        </button>
      </div>
      {suggestNote ? <p className="mb-3 rounded-lg bg-brand-50 px-3 py-2 text-sm text-brand-800">Suggested: {suggestNote}. Review and Save to confirm.</p> : null}

      <div className="grid grid-cols-2 gap-3">
        <label className="col-span-2 block">
          <span className={fieldLabel}>Category</span>
          <select className={field} value={optionValue} onChange={(e) => setOptionValue(e.target.value)}>
            <option value="">Uncategorised</option>
            {opts.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </label>
        <label className="block">
          <span className={fieldLabel}>Property</span>
          <select className={field} value={propertyId} onChange={(e) => setPropertyId(e.target.value)}>
            <option value="">Default portfolio</option>
            {properties.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
          </select>
        </label>
        <label className="block">
          <span className={fieldLabel}>Tenancy</span>
          <select className={field} value={tenancyId} onChange={(e) => setTenancyId(e.target.value)}>
            <option value="">None</option>
            {Object.entries(tenancyNames).map(([id, name]) => <option key={id} value={id}>{name}</option>)}
          </select>
        </label>
        <label className="col-span-2 block">
          <span className={fieldLabel}>Notes</span>
          <textarea className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional notes…" />
        </label>
        <div className="col-span-2 flex items-center justify-between gap-3">
          <div className="text-sm">
            {receiptRef ? (
              <span className="text-slate-600">📎 {receiptRef.split("/").pop()} <button onClick={() => setReceiptRef("")} className="ml-1 text-red-600 hover:underline">remove</button></span>
            ) : (
              <label className="cursor-pointer font-medium text-brand-700 hover:text-brand-800">
                📎 Attach receipt
                <input type="file" className="hidden" onChange={(e) => setReceiptRef(e.target.files?.[0] ? `/files/receipts/${e.target.files[0].name}` : "")} />
              </label>
            )}
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500" checked={reconciled} onChange={(e) => setReconciled(e.target.checked)} disabled={deactivated} />
            Reconciled
          </label>
        </div>
      </div>
    </Modal>
  );
}

// --- Bulk recategorise -------------------------------------------------------

function BulkRecategoriseModal({ open, count, onClose, onApply }: { open: boolean; count: number; onClose: () => void; onApply: (optionValue: string) => void }) {
  const [optionValue, setOptionValue] = useState("");
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Recategorise selected"
      description={`Apply one category to ${count} selected transaction${count === 1 ? "" : "s"}.`}
      size="sm"
      footer={
        <div className="flex w-full justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={() => onApply(optionValue)} disabled={!optionValue}>Apply</Button>
        </div>
      }
    >
      <select className={field} value={optionValue} onChange={(e) => setOptionValue(e.target.value)}>
        <option value="">Choose a category…</option>
        <optgroup label="Income">{optionsForDirection("income").map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</optgroup>
        <optgroup label="Expense">{optionsForDirection("expense").map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</optgroup>
      </select>
    </Modal>
  );
}

// --- Auto-suggest review (propose → user confirms) --------------------------

function AutoSuggestModal({
  open,
  targets,
  suggestContext,
  propertyNames,
  activeTenancyByProperty,
  onClose,
  onApply,
}: {
  open: boolean;
  targets: Transaction[];
  suggestContext: SuggestContext;
  propertyNames: Record<string, string>;
  activeTenancyByProperty: Record<string, string>;
  onClose: () => void;
  onApply: (applied: Record<string, Transaction>) => void;
}) {
  const proposals = useMemo(
    () =>
      targets
        .map((t) => ({ tx: t, s: suggestCategorisation(t, suggestContext) }))
        .filter((p): p is { tx: Transaction; s: NonNullable<typeof p.s> } => p.s != null),
    [targets, suggestContext],
  );
  const [include, setInclude] = useState<Set<string>>(new Set(proposals.map((p) => p.tx.id)));
  // Reset selection whenever the modal opens with new targets.
  useEffect(() => {
    if (open) setInclude(new Set(proposals.map((p) => p.tx.id)));
  }, [open, proposals]);

  function apply() {
    const applied: Record<string, Transaction> = {};
    for (const { tx, s } of proposals) {
      if (!include.has(tx.id)) continue;
      let tenancyId = s.tenancyId;
      if (s.category === "rent" && s.propertyId && !tenancyId) tenancyId = activeTenancyByProperty[s.propertyId];
      applied[tx.id] = { ...tx, category: s.category, subcategory: s.subcategory, propertyId: s.propertyId ?? tx.propertyId, tenancyId };
    }
    onApply(applied);
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Auto-suggest categories"
      description="We propose a category and property from each payee. Review, then confirm."
      size="lg"
      footer={
        <div className="flex w-full justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={apply} disabled={include.size === 0}>Apply {include.size} suggestion{include.size === 1 ? "" : "s"}</Button>
        </div>
      }
    >
      {proposals.length === 0 ? (
        <p className="text-sm text-slate-500">No confident suggestions for the selected items.</p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {proposals.map(({ tx, s }) => (
            <li key={tx.id} className="flex items-start gap-3 py-2.5">
              <input type="checkbox" className="mt-1 h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500" checked={include.has(tx.id)} onChange={() => setInclude((prev) => { const n = new Set(prev); n.has(tx.id) ? n.delete(tx.id) : n.add(tx.id); return n; })} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-slate-900">{tx.description} · {formatGBP(tx.amountPence)}</p>
                <p className="text-xs text-slate-500">
                  → <span className="font-medium text-brand-700">{categoryLabel(s.category)}</span>
                  {s.propertyId ? ` · ${propertyNames[s.propertyId] ?? "Property"}` : ""}
                  {" · "}{s.reason}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
}

// --- Add transaction manually ------------------------------------------------

let manualSeq = 0;

function AddTransactionModal({ open, onClose, onAdd, properties }: { open: boolean; onClose: () => void; onAdd: (t: Transaction) => void; properties: LedgerOption[] }) {
  const [date, setDate] = useState("");
  const [description, setDescription] = useState("");
  const [direction, setDirection] = useState<"income" | "expense">("expense");
  const [amount, setAmount] = useState("");
  const [propertyId, setPropertyId] = useState("");
  const [optionValue, setOptionValue] = useState("");
  const [error, setError] = useState<string | null>(null);

  const opts = optionsForDirection(direction);

  function submit() {
    setError(null);
    if (!description.trim()) return setError("Enter a description.");
    const pounds = Number(amount);
    if (!pounds || pounds <= 0) return setError("Enter an amount greater than zero.");
    const opt = resolveOption(optionValue);
    manualSeq += 1;
    onAdd({
      id: `txn_manual_${manualSeq}`,
      accountId: "acc_1",
      propertyId: propertyId || undefined,
      date: date || new Date().toISOString().slice(0, 10),
      direction,
      amountPence: poundsToPence(pounds),
      category: opt?.category,
      subcategory: opt?.subcategory,
      description: description.trim(),
      source: "manual",
      reconcile: "reconciled",
    });
    setDate(""); setDescription(""); setAmount(""); setPropertyId(""); setOptionValue(""); setDirection("expense");
  }

  return (
    <Modal open={open} onClose={onClose} title="Add transaction" size="md" footer={<div className="flex w-full items-center justify-end gap-2"><Button variant="secondary" onClick={onClose}>Cancel</Button><Button onClick={submit}>Add transaction</Button></div>}>
      <div className="grid grid-cols-2 gap-3">
        <label className="block"><span className={fieldLabel}>Direction</span>
          <select className={field} value={direction} onChange={(e) => { setDirection(e.target.value as "income" | "expense"); setOptionValue(""); }}>
            <option value="expense">Expense</option>
            <option value="income">Income</option>
          </select>
        </label>
        <label className="block"><span className={fieldLabel}>Amount (£)</span>
          <input type="number" min={0} step="0.01" className={field} value={amount} onChange={(e) => setAmount(e.target.value)} />
        </label>
        <label className="col-span-2 block"><span className={fieldLabel}>Description</span>
          <input className={field} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="e.g. Rent — J Fletcher" />
        </label>
        <label className="block"><span className={fieldLabel}>Date</span>
          <input type="date" className={field} value={date} onChange={(e) => setDate(e.target.value)} />
        </label>
        <label className="block"><span className={fieldLabel}>Property</span>
          <select className={field} value={propertyId} onChange={(e) => setPropertyId(e.target.value)}>
            <option value="">Default portfolio</option>
            {properties.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
          </select>
        </label>
        <label className="col-span-2 block"><span className={fieldLabel}>Category</span>
          <select className={field} value={optionValue} onChange={(e) => setOptionValue(e.target.value)}>
            <option value="">Uncategorised</option>
            {opts.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </label>
      </div>
      {error ? <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}
    </Modal>
  );
}
