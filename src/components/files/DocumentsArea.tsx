"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card, CardHeader, StatTile, Badge, Button } from "@/components/ui";
import { Modal } from "@/components/ds/Modal";
import { Tabs } from "@/components/ds/Tabs";
import { ExpiryBadge } from "@/components/ExpiryBadge";
import { formatGBP } from "@/lib/money";
import { formatDate, expiryUrgency } from "@/lib/dates";
import {
  BUILT_IN_CATEGORIES,
  EXPIRY_WINDOWS,
  reminderSchedule,
  withinExpiryWindow,
  type DocCategory,
  type DocGroup,
} from "@/lib/documents";
import { uploadDocumentAction } from "@/app/(app)/files/actions";

export interface DocRow {
  id: string;
  title: string;
  categoryId: string;
  categoryLabel: string;
  group: DocGroup;
  type: string;
  propertyId: string;
  propertyName: string;
  tenancyId?: string;
  tenancyName?: string;
  issueDate?: string;
  expiryDate?: string;
}
export interface ReceiptRow { id: string; description: string; date: string; propertyName: string; amountPence: number }
export interface ReportRow { id: string; title: string; description: string }

export interface DocumentsAreaProps {
  docs: DocRow[];
  receipts: ReceiptRow[];
  reports: ReportRow[];
  properties: { id: string; name: string }[];
  tenancies: { id: string; label: string; propertyId: string }[];
  notificationsEnabled: boolean;
}

const selectClass = "h-10 appearance-none rounded-lg border border-slate-300 bg-white pl-3 pr-9 text-sm text-slate-900 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100";

export function DocumentsArea({ docs: initial, receipts, reports, properties, tenancies, notificationsEnabled }: DocumentsAreaProps) {
  const [docs, setDocs] = useState<DocRow[]>(initial);
  const [custom, setCustom] = useState<DocCategory[]>([]);
  const [tab, setTab] = useState("documents");
  const [category, setCategory] = useState("");
  const [window, setWindow] = useState("any");
  const [scope, setScope] = useState("");
  const [uploadOpen, setUploadOpen] = useState(false);
  const [catOpen, setCatOpen] = useState(false);

  const allCategories = useMemo(() => [...BUILT_IN_CATEGORIES, ...custom], [custom]);
  const windowDays = EXPIRY_WINDOWS.find((w) => w.id === window)?.days ?? null;

  const visibleDocs = useMemo(() => {
    return docs.filter((d) => {
      if (category && d.categoryId !== category) return false;
      if (!withinExpiryWindow(d.expiryDate, windowDays)) return false;
      if (scope) {
        const [kind, id] = scope.split(":");
        if (kind === "prop" && d.propertyId !== id) return false;
        if (kind === "ten" && d.tenancyId !== id) return false;
      }
      return true;
    });
  }, [docs, category, windowDays, scope]);

  const expired = docs.filter((d) => d.expiryDate && expiryUrgency(d.expiryDate).urgency === "expired").length;
  const dueSoon = docs.filter((d) => d.expiryDate && ["critical", "soon", "upcoming"].includes(expiryUrgency(d.expiryDate).urgency)).length;
  const valid = docs.filter((d) => d.expiryDate && expiryUrgency(d.expiryDate).urgency === "ok").length;

  return (
    <>
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Documents</h1>
          <p className="mt-1 text-sm text-slate-500">Store certificates and receipts, track expiries, and never miss a renewal.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="secondary" onClick={() => setCatOpen(true)}>Add custom category</Button>
          <Button onClick={() => setUploadOpen(true)}>Upload new file</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatTile label="Expired" value={String(expired)} tone={expired > 0 ? "danger" : "success"} sub="needs action now" />
        <StatTile label="Due soon" value={String(dueSoon)} tone={dueSoon > 0 ? "warning" : "success"} sub="within 30 days" />
        <StatTile label="Valid" value={String(valid)} tone="success" sub="no action needed" />
      </div>

      <Tabs
        value={tab}
        onChange={setTab}
        items={[
          { id: "documents", label: "Documents", badge: docs.length },
          { id: "receipts", label: "Receipts", badge: receipts.length },
          { id: "reports", label: "Reports", badge: reports.length },
          { id: "custom", label: "Custom categories", badge: custom.length },
        ]}
      />

      {tab === "documents" ? (
        <>
          {/* Filters */}
          <div className="flex flex-wrap items-center gap-2">
            <select aria-label="Category" className={selectClass} value={category} onChange={(e) => setCategory(e.target.value)}>
              <option value="">All categories</option>
              {allCategories.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
            </select>
            <select aria-label="Expiry window" className={selectClass} value={window} onChange={(e) => setWindow(e.target.value)}>
              {EXPIRY_WINDOWS.map((w) => <option key={w.id} value={w.id}>{w.label}</option>)}
            </select>
            <select aria-label="Scope" className={selectClass} value={scope} onChange={(e) => setScope(e.target.value)}>
              <option value="">All properties &amp; tenants</option>
              <optgroup label="Properties">{properties.map((p) => <option key={p.id} value={`prop:${p.id}`}>{p.name}</option>)}</optgroup>
              <optgroup label="Tenants">{tenancies.map((t) => <option key={t.id} value={`ten:${t.id}`}>{t.label}</option>)}</optgroup>
            </select>
          </div>
          <DocumentsTable rows={visibleDocs} notificationsEnabled={notificationsEnabled} />
        </>
      ) : null}

      {tab === "receipts" ? <ReceiptsTable rows={receipts} /> : null}
      {tab === "reports" ? <ReportsTab rows={reports} /> : null}
      {tab === "custom" ? <CustomCategoriesTab custom={custom} onAdd={() => setCatOpen(true)} /> : null}

      <UploadModal
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        properties={properties}
        tenancies={tenancies}
        categories={allCategories}
        notificationsEnabled={notificationsEnabled}
        onUploaded={(row) => setDocs((d) => [row, ...d])}
      />
      <AddCategoryModal open={catOpen} onClose={() => setCatOpen(false)} onAdd={(c) => setCustom((x) => [...x, c])} />
    </>
  );
}

function DocumentsTable({ rows, notificationsEnabled }: { rows: DocRow[]; notificationsEnabled: boolean }) {
  if (rows.length === 0) return <Card className="px-6 py-12 text-center text-sm text-slate-500">No documents match these filters.</Card>;
  return (
    <Card>
      <CardHeader title="Documents" subtitle={`${rows.length} shown`} />
      <div className="overflow-x-auto">
        <table className="w-full min-w-[820px] text-sm">
          <thead>
            <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-400">
              <th className="px-5 py-3 font-medium">Document</th>
              <th className="px-5 py-3 font-medium">Category</th>
              <th className="px-5 py-3 font-medium">Property / tenancy</th>
              <th className="px-5 py-3 font-medium">Expires</th>
              <th className="px-5 py-3 font-medium">Reminders</th>
              <th className="px-5 py-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((d) => {
              const reminders = reminderSchedule(d.expiryDate, notificationsEnabled);
              return (
                <tr key={d.id} className="hover:bg-slate-50">
                  <td className="px-5 py-3 font-medium text-slate-900">{d.title}</td>
                  <td className="px-5 py-3 text-slate-600">{d.categoryLabel}</td>
                  <td className="px-5 py-3 text-slate-600">{d.propertyName}{d.tenancyName ? <span className="block text-xs text-slate-400">{d.tenancyName}</span> : null}</td>
                  <td className="px-5 py-3 text-slate-600">{d.expiryDate ? formatDate(d.expiryDate) : "—"}</td>
                  <td className="px-5 py-3 text-slate-600">{d.expiryDate ? (reminders.length ? `${reminders.length} scheduled` : "—") : "—"}</td>
                  <td className="px-5 py-3"><ExpiryBadge expiryDate={d.expiryDate} /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function ReceiptsTable({ rows }: { rows: ReceiptRow[] }) {
  if (rows.length === 0) return <Card className="px-6 py-12 text-center text-sm text-slate-500">No receipts yet — attach receipts to transactions or upload one.</Card>;
  return (
    <Card>
      <CardHeader title="Receipts & invoices" subtitle={`${rows.length} attached`} />
      <ul className="divide-y divide-slate-100">
        {rows.map((r) => (
          <li key={r.id} className="flex items-center justify-between gap-3 px-5 py-3">
            <div className="min-w-0"><p className="truncate text-sm font-medium text-slate-900">📎 {r.description}</p><p className="text-xs text-slate-500">{formatDate(r.date)} · {r.propertyName}</p></div>
            <span className="text-sm font-semibold text-slate-700">{formatGBP(r.amountPence)}</span>
          </li>
        ))}
      </ul>
    </Card>
  );
}

function ReportsTab({ rows }: { rows: ReportRow[] }) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      {rows.map((r) => (
        <Card key={r.id} className="flex items-start justify-between gap-3 p-5">
          <div><h3 className="font-semibold text-slate-900">{r.title}</h3><p className="mt-1 text-sm text-slate-500">{r.description}</p></div>
          <Button variant="secondary">Generate</Button>
        </Card>
      ))}
    </div>
  );
}

const GROUP_LABELS: Record<DocGroup, string> = { compliance: "Compliance", insurance: "Insurance", financial: "Financial", tenancy: "Tenancy", branding: "Branding", import: "Imports", receipt: "Receipts", other: "Other" };

function CustomCategoriesTab({ custom, onAdd }: { custom: DocCategory[]; onAdd: () => void }) {
  const groups = Array.from(new Set(BUILT_IN_CATEGORIES.map((c) => c.group)));
  return (
    <div className="space-y-4">
      <Card className="flex items-center justify-between gap-3 p-5">
        <div><h3 className="font-semibold text-slate-900">Your categories</h3><p className="mt-1 text-sm text-slate-500">Built-in categories plus any you add. Custom categories work everywhere a built-in one does.</p></div>
        <Button onClick={onAdd}>Add custom category</Button>
      </Card>
      {custom.length ? (
        <Card><CardHeader title="Custom categories" subtitle={`${custom.length}`} />
          <ul className="divide-y divide-slate-100">{custom.map((c) => <li key={c.id} className="flex items-center justify-between px-5 py-3 text-sm"><span className="font-medium text-slate-800">{c.label}</span><Badge tone="brand">{GROUP_LABELS[c.group]}</Badge></li>)}</ul>
        </Card>
      ) : null}
      <Card><CardHeader title="Built-in categories" subtitle={`${BUILT_IN_CATEGORIES.length}`} />
        <div className="grid grid-cols-1 gap-4 p-5 sm:grid-cols-2 lg:grid-cols-3">
          {groups.map((g) => (
            <div key={g}>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">{GROUP_LABELS[g]}</p>
              <ul className="space-y-1 text-sm text-slate-600">{BUILT_IN_CATEGORIES.filter((c) => c.group === g).map((c) => <li key={c.id}>{c.label}</li>)}</ul>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

const field = "h-10 w-full appearance-none rounded-lg border border-slate-300 px-3 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100";
const fieldLabel = "mb-1 block text-sm font-medium text-slate-700";

function UploadModal({ open, onClose, properties, tenancies, categories, notificationsEnabled, onUploaded }: {
  open: boolean; onClose: () => void; properties: { id: string; name: string }[]; tenancies: { id: string; label: string; propertyId: string }[]; categories: DocCategory[]; notificationsEnabled: boolean; onUploaded: (row: DocRow) => void;
}) {
  const router = useRouter();
  const [, start] = useTransition();
  const [categoryId, setCategoryId] = useState("gas_safety");
  const [propertyId, setPropertyId] = useState("");
  const [tenancyId, setTenancyId] = useState("");
  const [title, setTitle] = useState("");
  const [issueDate, setIssueDate] = useState("");
  const [expiryDate, setExpiryDate] = useState("");
  const [error, setError] = useState<string | null>(null);

  const cat = categories.find((c) => c.id === categoryId);
  const reminders = reminderSchedule(expiryDate, notificationsEnabled);
  const tenancyOpts = tenancies.filter((t) => !propertyId || t.propertyId === propertyId);

  function submit() {
    setError(null);
    if (!propertyId) return setError("Choose a property.");
    if (!title.trim()) return setError("Give the document a title.");
    const property = properties.find((p) => p.id === propertyId)!;
    const tenancy = tenancies.find((t) => t.id === tenancyId);
    onUploaded({
      id: `doc_local_${Date.now()}`, title: title.trim(), categoryId, categoryLabel: cat?.label ?? categoryId, group: cat?.group ?? "other",
      type: "other", propertyId, propertyName: property.name, tenancyId: tenancyId || undefined, tenancyName: tenancy?.label,
      issueDate: issueDate || undefined, expiryDate: expiryDate || undefined,
    });
    start(async () => {
      await uploadDocumentAction({ propertyId, tenancyId: tenancyId || undefined, category: categoryId, type: "other", title: title.trim(), issueDate: issueDate || undefined, expiryDate: expiryDate || undefined, fileRef: `/files/${title.trim().replace(/\s+/g, "-").toLowerCase()}.pdf` });
      router.refresh();
    });
    setTitle(""); setIssueDate(""); setExpiryDate(""); setTenancyId("");
    onClose();
  }

  return (
    <Modal open={open} onClose={onClose} title="Upload new file" size="lg"
      footer={<div className="flex w-full justify-end gap-2"><Button variant="secondary" onClick={onClose}>Cancel</Button><Button onClick={submit}>Upload</Button></div>}>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="block sm:col-span-2"><span className={fieldLabel}>Category</span>
          <select className={field} value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
          </select>
        </label>
        <label className="block sm:col-span-2"><span className={fieldLabel}>Title</span><input className={field} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Gas Safety Certificate (CP12)" /></label>
        <label className="block"><span className={fieldLabel}>Property</span>
          <select className={field} value={propertyId} onChange={(e) => { setPropertyId(e.target.value); setTenancyId(""); }}>
            <option value="">Choose a property…</option>
            {properties.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </label>
        <label className="block"><span className={fieldLabel}>Tenancy (optional)</span>
          <select className={field} value={tenancyId} onChange={(e) => setTenancyId(e.target.value)}>
            <option value="">None</option>
            {tenancyOpts.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
          </select>
        </label>
        <label className="block"><span className={fieldLabel}>Issue date</span><input type="date" className={field} value={issueDate} onChange={(e) => setIssueDate(e.target.value)} /></label>
        <label className="block"><span className={fieldLabel}>Expiry date</span><input type="date" className={field} value={expiryDate} onChange={(e) => setExpiryDate(e.target.value)} /></label>
        <label className="block sm:col-span-2"><span className={fieldLabel}>File</span>
          <input type="file" className="block w-full text-sm text-slate-500 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:text-sm file:font-medium hover:file:bg-slate-200" onChange={(e) => { if (!title && e.target.files?.[0]) setTitle(e.target.files[0].name.replace(/\.[^.]+$/, "")); }} />
        </label>
      </div>

      {expiryDate ? (
        <div className="mt-4 rounded-lg bg-brand-50 p-3 text-sm">
          <p className="font-medium text-brand-900">📅 Added to your calendar on {formatDate(expiryDate)}.</p>
          {reminders.length ? (
            <p className="mt-1 text-brand-800">🔔 {reminders.length} reminder{reminders.length === 1 ? "" : "s"} scheduled — {reminders.map((r) => `${r.daysBefore}d`).join(", ")} before ({reminders.map((r) => formatDate(r.date)).join(", ")}).</p>
          ) : (
            <p className="mt-1 text-slate-500">{notificationsEnabled ? "Expiry is too soon for advance reminders." : "Notifications are off — enable them in settings to get reminders."}</p>
          )}
        </div>
      ) : null}

      {error ? <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}
    </Modal>
  );
}

function AddCategoryModal({ open, onClose, onAdd }: { open: boolean; onClose: () => void; onAdd: (c: DocCategory) => void }) {
  const [label, setLabel] = useState("");
  const [group, setGroup] = useState<DocGroup>("other");
  function submit() {
    if (!label.trim()) return;
    onAdd({ id: `custom_${label.trim().toLowerCase().replace(/\s+/g, "_")}`, label: label.trim(), group });
    setLabel("");
    onClose();
  }
  return (
    <Modal open={open} onClose={onClose} title="Add custom category" size="sm"
      footer={<div className="flex w-full justify-end gap-2"><Button variant="secondary" onClick={onClose}>Cancel</Button><Button onClick={submit} disabled={!label.trim()}>Add category</Button></div>}>
      <div className="space-y-3">
        <label className="block"><span className={fieldLabel}>Category name</span><input className={field} value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. Boiler service record" /></label>
        <label className="block"><span className={fieldLabel}>Group</span>
          <select className={field} value={group} onChange={(e) => setGroup(e.target.value as DocGroup)}>
            {Object.entries(GROUP_LABELS).map(([g, l]) => <option key={g} value={g}>{l}</option>)}
          </select>
        </label>
      </div>
    </Modal>
  );
}
