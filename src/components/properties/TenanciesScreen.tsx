"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card, Badge, Button } from "@/components/ui";
import { Modal } from "@/components/ds/Modal";
import { SummaryMetrics, type SummaryData } from "./SummaryMetrics";
import { formatGBP, poundsToPence } from "@/lib/money";
import { formatDate } from "@/lib/dates";
import { parseCsv } from "@/lib/import/csv";
import { createTenancyAction, type CreateTenancyInput } from "@/app/(app)/properties/tenancies/actions";

const gbp = (p: number) => formatGBP(p, { showPence: false });

export interface TenancyRowData {
  id: string;
  propertyId: string;
  propertyName: string;
  propertyAddress: string;
  tenantName: string;
  status: "active" | "ended" | "vacant";
  nextPaymentDate: string | null;
  depositPence: number;
  startDate: string;
  endDate: string | null;
  rentPence: number;
  rentFrequency: "monthly" | "weekly";
  arrearsStatus: "up_to_date" | "in_arrears" | "in_credit";
  balancePence: number;
  tracked: boolean;
}

export interface TenanciesScreenProps {
  summary: SummaryData;
  rows: TenancyRowData[];
  properties: { id: string; name: string; address: string }[];
}

const selectClass = "h-10 appearance-none rounded-lg border border-slate-300 bg-white pl-3 pr-9 text-sm text-slate-900 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100";

// Inline monthly/weekly next-due preview (kept pure to avoid bundling the repo).
function schedulePreview(rentDueDay: number, rentPence: number, frequency: string, startDate: string, count = 4): { dueDate: string; amountPence: number }[] {
  if (!startDate) return [];
  const out: { dueDate: string; amountPence: number }[] = [];
  if (frequency === "weekly") {
    let d = new Date(`${startDate}T00:00:00Z`);
    while (out.length < count && !Number.isNaN(d.getTime())) {
      out.push({ dueDate: d.toISOString().slice(0, 10), amountPence: rentPence });
      d = new Date(d.getTime() + 7 * 86_400_000);
    }
    return out;
  }
  let year = Number(startDate.slice(0, 4));
  let month = Number(startDate.slice(5, 7));
  for (let i = 0; i < 24 && out.length < count; i++) {
    const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
    const day = Math.min(rentDueDay, last);
    const iso = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    if (iso >= startDate) out.push({ dueDate: iso, amountPence: rentPence });
    month += 1; if (month > 12) { month = 1; year += 1; }
  }
  return out;
}

export function TenanciesScreen({ summary, rows: initial, properties }: TenanciesScreenProps) {
  const [rows, setRows] = useState<TenancyRowData[]>(initial);
  const [search, setSearch] = useState("");
  const [propertyId, setPropertyId] = useState("");
  const [status, setStatus] = useState("active");
  const [sort, setSort] = useState("tenant");
  const [addOpen, setAddOpen] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);

  const liveSummary: SummaryData = useMemo(() => {
    const active = rows.filter((r) => r.status === "active").length;
    return { ...summary, activeTenancyCount: active };
  }, [rows, summary]);

  const visible = useMemo(() => {
    let list = rows;
    if (status !== "all") list = list.filter((r) => r.status === status);
    if (propertyId) list = list.filter((r) => r.propertyId === propertyId);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((r) => r.tenantName.toLowerCase().includes(q) || r.propertyAddress.toLowerCase().includes(q) || r.propertyName.toLowerCase().includes(q));
    }
    return sort === "tenant" ? [...list].sort((a, b) => a.tenantName.localeCompare(b.tenantName)) : list;
  }, [rows, status, propertyId, search, sort]);

  function addTenancy(row: TenancyRowData) {
    setRows((r) => [row, ...r]);
  }

  return (
    <>
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Tenancies</h1>
          <p className="mt-1 text-sm text-slate-500">Every tenancy, its rent schedule, status and arrears.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="secondary" onClick={() => setUploadOpen(true)}>Upload tenancies</Button>
          <Button onClick={() => setAddOpen(true)}>Add tenancy</Button>
        </div>
      </div>

      <SummaryMetrics summary={liveSummary} />

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <input aria-label="Search" placeholder="Search tenant or address…" className="h-10 w-56 rounded-lg border border-slate-300 px-3 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100" value={search} onChange={(e) => setSearch(e.target.value)} />
        <select aria-label="Select Property" className={selectClass} value={propertyId} onChange={(e) => setPropertyId(e.target.value)}>
          <option value="">All properties</option>
          {properties.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <select aria-label="Status" className={selectClass} value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="active">Active tenancies</option>
          <option value="ended">Ended</option>
          <option value="all">All statuses</option>
        </select>
        <select aria-label="Sort" className={selectClass} value={sort} onChange={(e) => setSort(e.target.value)}>
          <option value="tenant">Tenant A–Z</option>
          <option value="none">Default order</option>
        </select>
      </div>

      {/* Tenancy cards */}
      {visible.length === 0 ? (
        <Card className="px-6 py-12 text-center text-sm text-slate-500">No tenancies match these filters.</Card>
      ) : (
        <div className="space-y-3">
          {visible.map((t) => <TenancyCard key={t.id} t={t} />)}
        </div>
      )}

      <AddTenancyModal open={addOpen} onClose={() => setAddOpen(false)} properties={properties} onCreated={addTenancy} />
      <UploadTenanciesModal open={uploadOpen} onClose={() => setUploadOpen(false)} properties={properties} onImport={(newRows) => { setRows((r) => [...newRows, ...r]); }} />
    </>
  );
}

function TenancyCard({ t }: { t: TenancyRowData }) {
  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-semibold text-slate-900">{t.tenantName}</h3>
          <Link href={`/properties/${t.propertyId}`} className="text-sm text-brand-700 hover:text-brand-800">{t.propertyAddress}</Link>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={t.status === "active" ? "brand" : "neutral"}>{t.status === "active" ? "Active" : t.status === "ended" ? "Ended" : "Vacant"}</Badge>
          {!t.tracked ? <Badge tone="warning">Untracked</Badge>
            : t.arrearsStatus === "in_arrears" ? <Badge tone="danger">{gbp(t.balancePence)} arrears</Badge>
            : t.arrearsStatus === "in_credit" ? <Badge tone="info">{gbp(Math.abs(t.balancePence))} credit</Badge>
            : <Badge tone="success">Up to date</Badge>}
        </div>
      </div>
      <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 text-sm sm:grid-cols-3 lg:grid-cols-6">
        <Field label="Rent">{gbp(t.rentPence)} / {t.rentFrequency === "monthly" ? "mo" : "wk"}</Field>
        <Field label="Next payment">{t.nextPaymentDate ? formatDate(t.nextPaymentDate) : "—"}</Field>
        <Field label="Deposit">{t.depositPence ? gbp(t.depositPence) : "—"}</Field>
        <Field label="Start">{formatDate(t.startDate)}</Field>
        <Field label="End">{t.endDate ? formatDate(t.endDate) : "Ongoing"}</Field>
        <Field label="Property">{t.propertyName}</Field>
      </dl>
    </Card>
  );
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><dt className="text-xs uppercase tracking-wide text-slate-400">{label}</dt><dd className="font-medium text-slate-800">{children}</dd></div>;
}

const field = "h-10 w-full appearance-none rounded-lg border border-slate-300 px-3 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100";
const fieldLabel = "mb-1 block text-sm font-medium text-slate-700";

function AddTenancyModal({ open, onClose, properties, onCreated }: { open: boolean; onClose: () => void; properties: { id: string; name: string; address: string }[]; onCreated: (row: TenancyRowData) => void }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [tenantName, setTenantName] = useState("");
  const [tenantEmail, setTenantEmail] = useState("");
  const [propertyId, setPropertyId] = useState("");
  const [rent, setRent] = useState("");
  const [frequency, setFrequency] = useState<"monthly" | "weekly">("monthly");
  const [deposit, setDeposit] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [dueDay, setDueDay] = useState("1");
  const [error, setError] = useState<string | null>(null);

  const rentPence = poundsToPence(Number(rent) || 0);
  const preview = schedulePreview(Number(dueDay) || 1, rentPence, frequency, startDate);

  function submit() {
    setError(null);
    if (!tenantName.trim()) return setError("Enter the tenant's name.");
    if (!propertyId) return setError("Choose a property.");
    if (!rentPence) return setError("Enter a rent amount.");
    if (!startDate) return setError("Choose a start date.");

    const input: CreateTenancyInput = {
      propertyId, tenantName: tenantName.trim(), tenantEmail: tenantEmail.trim() || undefined,
      rentPence, rentFrequency: frequency, rentDueDay: Number(dueDay) || 1,
      depositPence: deposit ? poundsToPence(Number(deposit)) : undefined,
      startDate, endDate: endDate || undefined,
    };
    const property = properties.find((p) => p.id === propertyId)!;
    onCreated({
      id: `ten_local_${Date.now()}`, propertyId, propertyName: property.name, propertyAddress: property.address,
      tenantName: input.tenantName, status: "active", nextPaymentDate: preview[0]?.dueDate ?? null,
      depositPence: input.depositPence ?? 0, startDate, endDate: endDate || null, rentPence, rentFrequency: frequency,
      arrearsStatus: "up_to_date", balancePence: 0, tracked: false,
    });
    start(async () => { await createTenancyAction(input); router.refresh(); });
    // reset + close
    setTenantName(""); setTenantEmail(""); setPropertyId(""); setRent(""); setDeposit(""); setStartDate(""); setEndDate(""); setDueDay("1");
    onClose();
  }

  return (
    <Modal open={open} onClose={onClose} title="Add tenancy" size="lg"
      footer={<div className="flex w-full justify-end gap-2"><Button variant="secondary" onClick={onClose}>Cancel</Button><Button onClick={submit} disabled={pending}>Create tenancy</Button></div>}>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="block"><span className={fieldLabel}>Tenant name</span><input className={field} value={tenantName} onChange={(e) => setTenantName(e.target.value)} placeholder="Jane Doe" /></label>
        <label className="block"><span className={fieldLabel}>Tenant email</span><input type="email" className={field} value={tenantEmail} onChange={(e) => setTenantEmail(e.target.value)} placeholder="jane@example.com" /></label>
        <label className="block sm:col-span-2"><span className={fieldLabel}>Property</span>
          <select className={field} value={propertyId} onChange={(e) => setPropertyId(e.target.value)}>
            <option value="">Choose a property…</option>
            {properties.map((p) => <option key={p.id} value={p.id}>{p.name} — {p.address}</option>)}
          </select>
        </label>
        <label className="block"><span className={fieldLabel}>Rent (£)</span><input type="number" min={0} step="0.01" className={field} value={rent} onChange={(e) => setRent(e.target.value)} /></label>
        <label className="block"><span className={fieldLabel}>Frequency</span>
          <select className={field} value={frequency} onChange={(e) => setFrequency(e.target.value as "monthly" | "weekly")}><option value="monthly">Monthly</option><option value="weekly">Weekly</option></select>
        </label>
        <label className="block"><span className={fieldLabel}>Deposit (£)</span><input type="number" min={0} step="0.01" className={field} value={deposit} onChange={(e) => setDeposit(e.target.value)} /></label>
        <label className="block"><span className={fieldLabel}>Rent due day (1–28)</span><input type="number" min={1} max={28} className={field} value={dueDay} onChange={(e) => setDueDay(e.target.value)} /></label>
        <label className="block"><span className={fieldLabel}>Start date</span><input type="date" className={field} value={startDate} onChange={(e) => setStartDate(e.target.value)} /></label>
        <label className="block"><span className={fieldLabel}>End date (optional)</span><input type="date" className={field} value={endDate} onChange={(e) => setEndDate(e.target.value)} /></label>
      </div>

      {preview.length ? (
        <div className="mt-4 rounded-lg bg-slate-50 p-3">
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">Expected-rent schedule</p>
          <ul className="flex flex-wrap gap-2 text-sm">
            {preview.map((s) => <li key={s.dueDate} className="rounded-full bg-white px-2.5 py-1 ring-1 ring-inset ring-slate-200">{formatDate(s.dueDate)} · {gbp(s.amountPence)}</li>)}
          </ul>
        </div>
      ) : null}

      {error ? <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}
    </Modal>
  );
}

const SAMPLE_TENANCIES_CSV = `Tenant,Email,Property,Rent,Frequency,Deposit,Start,DueDay,End
Liam Carter,liam@example.com,Oakfield Road,1300,monthly,1500,2026-07-01,1,
Nadia Khan,nadia@example.com,Station Mews,1650,monthly,1900,2026-07-05,5,2027-07-04`;

function UploadTenanciesModal({ open, onClose, properties, onImport }: { open: boolean; onClose: () => void; properties: { id: string; name: string; address: string }[]; onImport: (rows: TenancyRowData[]) => void }) {
  const [parsed, setParsed] = useState<{ rows: TenancyRowData[]; errors: number } | null>(null);

  function load(text: string) {
    const { headers, rows } = parseCsv(text);
    const idx = (name: string) => headers.findIndex((h) => h.toLowerCase() === name);
    const col = { tenant: idx("tenant"), email: idx("email"), property: idx("property"), rent: idx("rent"), freq: idx("frequency"), deposit: idx("deposit"), start: idx("start"), due: idx("dueday"), end: idx("end") };
    const out: TenancyRowData[] = [];
    let errors = 0;
    for (const r of rows) {
      const property = properties.find((p) => p.name.toLowerCase() === (r[col.property] ?? "").trim().toLowerCase());
      const rentPence = poundsToPence(Number((r[col.rent] ?? "").replace(/[£,]/g, "")) || 0);
      const start = (r[col.start] ?? "").trim();
      if (!property || !rentPence || !start || !(r[col.tenant] ?? "").trim()) { errors += 1; continue; }
      const dueDay = Number(r[col.due]) || 1;
      const freq = (r[col.freq] ?? "monthly").trim().toLowerCase() === "weekly" ? "weekly" : "monthly";
      out.push({
        id: `ten_csv_${out.length}_${Date.now()}`, propertyId: property.id, propertyName: property.name, propertyAddress: property.address,
        tenantName: (r[col.tenant] ?? "").trim(), status: "active",
        nextPaymentDate: schedulePreview(dueDay, rentPence, freq, start, 1)[0]?.dueDate ?? null,
        depositPence: poundsToPence(Number(r[col.deposit]) || 0), startDate: start, endDate: (r[col.end] ?? "").trim() || null,
        rentPence, rentFrequency: freq, arrearsStatus: "up_to_date", balancePence: 0, tracked: false,
      });
    }
    setParsed({ rows: out, errors });
  }

  function commit() {
    if (parsed) onImport(parsed.rows);
    setParsed(null);
    onClose();
  }

  return (
    <Modal open={open} onClose={() => { setParsed(null); onClose(); }} title="Upload tenancies" size="md"
      footer={parsed ? <div className="flex w-full justify-end gap-2"><Button variant="secondary" onClick={() => setParsed(null)}>Back</Button><Button onClick={commit} disabled={parsed.rows.length === 0}>Import {parsed.rows.length} tenanc{parsed.rows.length === 1 ? "y" : "ies"}</Button></div> : undefined}>
      {!parsed ? (
        <div className="space-y-4">
          <p className="text-sm text-slate-600">Upload a CSV of tenancies (tenant, property, rent, deposit, start, due day). We&apos;ll generate each one&apos;s rent schedule.</p>
          <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-300 px-6 py-8 text-center hover:border-brand-400 hover:bg-brand-50/40">
            <span className="text-2xl">📄</span><span className="text-sm font-medium text-slate-700">Choose a .csv file</span>
            <input type="file" accept=".csv" className="hidden" onChange={(e) => e.target.files?.[0]?.text().then((t) => load(t))} />
          </label>
          <button onClick={() => load(SAMPLE_TENANCIES_CSV)} className="text-sm font-medium text-brand-700 hover:text-brand-800">Try a sample CSV →</button>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex gap-2"><Badge tone="success">{parsed.rows.length} ready</Badge>{parsed.errors ? <Badge tone="danger">{parsed.errors} skipped</Badge> : null}</div>
          <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200">
            {parsed.rows.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
                <span><span className="font-medium text-slate-900">{r.tenantName}</span> · {r.propertyName}</span>
                <span className="text-slate-500">{gbp(r.rentPence)} · from {formatDate(r.startDate)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Modal>
  );
}
