"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card, CardHeader, Badge, Button } from "@/components/ui";
import { Modal } from "@/components/ds/Modal";
import { Tabs } from "@/components/ds/Tabs";
import { PropertyIcon, LockIcon, ChevronRightIcon } from "@/components/icons";
import { formatGBP } from "@/lib/money";
import { formatDate, formatDateTime, taxYearBounds } from "@/lib/dates";
import { archivePropertyAction, restorePropertyAction, setPortfolioAction } from "@/app/(app)/properties/[id]/actions";

const gbp = (p: number) => formatGBP(p, { showPence: false });

export interface DetailTx {
  id: string;
  date: string;
  description: string;
  categoryLabel: string;
  direction: "income" | "expense";
  amountPence: number;
  reconcile: string;
}

export interface PropertyDetailData {
  id: string;
  nickname: string;
  addressLine: string;
  address: { line1: string; line2?: string; city: string; postcode: string };
  typeLabel: string;
  bedrooms: number;
  archived: boolean;
  portfolioId: string;
  portfolios: { id: string; name: string }[];
  metrics: {
    rentPence: number;
    annualYieldPercent: number | null;
    mortgageBalancePence: number | null;
    valuationPence: number | null;
    purchasePricePence: number | null;
    ltvPercent: number | null;
  };
  purchaseDate?: string;
  pnl12m: { hasData: boolean; incomePence: number; expensesPence: number; profitPence: number };
  gated: boolean;
  taxYears: string[];
  mortgage: { lender: string; balancePence: number; monthlyPaymentPence: number | null; ratePct: number | null; repaymentType: string | null; ltvPercent: number | null } | null;
  valuations: { id: string; amountPence: number; date: string; source?: string }[];
  tenancy: { tenants: string[]; rentPence: number; frequency: string; dueDay: number; startDate: string; depositPence?: number; depositScheme?: string; arrearsStatus: string; arrearsPence: number; lastPaymentDate?: string } | null;
  tenancyTracked: boolean;
  documents: { id: string; typeLabel: string; title: string; expiryDate?: string }[];
  epc: { rating: string; expiryDate: string; issueDate?: string; expired: boolean } | null;
  notes: { id: string; body: string; author: string; createdAt: string }[];
  transactions: DetailTx[];
}

export function PropertyDetail({ data }: { data: PropertyDetailData }) {
  const [tab, setTab] = useState("info");
  // Optimistic archive state — the server action also fires for real persistence.
  const [archived, setArchived] = useState(data.archived);

  return (
    <>
      {/* Breadcrumb */}
      <div className="flex items-center gap-1.5 text-sm text-slate-500">
        <Link href="/properties" className="hover:text-slate-700">My Properties</Link>
        <span className="text-slate-300">/</span>
        <span className="font-medium text-slate-700">{data.nickname}</span>
      </div>

      {archived ? <ArchivedBanner id={data.id} onRestore={() => setArchived(false)} /> : null}

      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">{data.nickname}</h1>
          <p className="mt-1 text-sm text-slate-500">{data.addressLine}</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Badge tone="neutral">{data.typeLabel}</Badge>
            <Badge tone="neutral">{data.bedrooms} bed</Badge>
            <Badge tone={data.tenancy ? "brand" : "neutral"}>{data.tenancy ? "Occupied" : "Vacant"}</Badge>
            {archived ? <Badge tone="warning">Archived</Badge> : null}
          </div>
        </div>
        <HeaderActions id={data.id} archived={archived} setArchived={setArchived} address={data.address} nickname={data.nickname} />
      </div>

      <Tabs
        value={tab}
        onChange={setTab}
        items={[
          { id: "info", label: "Property Info" },
          { id: "mortgages", label: "Mortgages & Valuations" },
          { id: "epc", label: "EPC" },
        ]}
      />

      {tab === "info" ? <PropertyInfoTab data={data} /> : null}
      {tab === "mortgages" ? <MortgagesTab data={data} /> : null}
      {tab === "epc" ? <EpcTab data={data} /> : null}
    </>
  );
}

// --- Header actions: archive + edit -----------------------------------------

function HeaderActions({ id, archived, setArchived, address, nickname }: { id: string; archived: boolean; setArchived: (v: boolean) => void; address: PropertyDetailData["address"]; nickname: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [editOpen, setEditOpen] = useState(false);
  const [confirmArchive, setConfirmArchive] = useState(false);

  function archive() {
    setArchived(true);
    setConfirmArchive(false);
    start(async () => { await archivePropertyAction(id); router.refresh(); });
  }
  function restore() {
    setArchived(false);
    start(async () => { await restorePropertyAction(id); router.refresh(); });
  }

  return (
    <div className="flex items-center gap-2">
      <Button variant="secondary" onClick={() => setEditOpen(true)}>Edit information</Button>
      {archived ? (
        <Button onClick={restore} disabled={pending}>{pending ? "Restoring…" : "Restore"}</Button>
      ) : (
        <Button variant="secondary" onClick={() => setConfirmArchive(true)}>Delete / archive</Button>
      )}

      <Modal open={confirmArchive} onClose={() => setConfirmArchive(false)} title="Archive this property?" size="sm"
        footer={<div className="flex w-full justify-end gap-2"><Button variant="secondary" onClick={() => setConfirmArchive(false)}>Cancel</Button><Button onClick={archive} disabled={pending}>{pending ? "Archiving…" : "Archive property"}</Button></div>}>
        <p className="text-sm text-slate-600">
          Archiving removes <strong>{nickname}</strong> from your active property lists, but keeps all
          its transactions, tenancies and documents for your records. You can restore it any time.
        </p>
      </Modal>

      <Modal open={editOpen} onClose={() => setEditOpen(false)} title="Edit property information" size="md"
        footer={<div className="flex w-full justify-end gap-2"><Button variant="secondary" onClick={() => setEditOpen(false)}>Cancel</Button><Button onClick={() => setEditOpen(false)}>Save</Button></div>}>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Nickname" defaultValue={nickname} />
          <Field label="Postcode" defaultValue={address.postcode} />
          <div className="sm:col-span-2"><Field label="Address line 1" defaultValue={address.line1} /></div>
          <Field label="Town / city" defaultValue={address.city} />
        </div>
      </Modal>
    </div>
  );
}

function Field({ label, defaultValue }: { label: string; defaultValue?: string }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-slate-700">{label}</span>
      <input defaultValue={defaultValue} className="h-10 w-full rounded-lg border border-slate-300 px-3 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100" />
    </label>
  );
}

function ArchivedBanner({ id, onRestore }: { id: string; onRestore: () => void }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
      <span>This property is archived — it&apos;s hidden from active lists. Its history is preserved.</span>
      <button onClick={() => { onRestore(); start(async () => { await restorePropertyAction(id); router.refresh(); }); }} disabled={pending} className="shrink-0 font-semibold underline underline-offset-2 hover:text-amber-950">
        {pending ? "Restoring…" : "Restore"}
      </button>
    </div>
  );
}

// --- Property Info tab -------------------------------------------------------

function PropertyInfoTab({ data }: { data: PropertyDetailData }) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <StreetView data={data} />
        <div className="lg:col-span-2">
          <HeaderMetrics data={data} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <ProfitLoss data={data} />
          <TenantsWidget data={data} />
          <IncomeExpenseAnalysis data={data} />
          <TransactionsWidget rows={data.transactions} />
        </div>
        <div className="space-y-6">
          <FinancialInfo data={data} />
          <DocumentsWidget data={data} />
          <NotesWidget notes={data.notes} author="You" />
        </div>
      </div>
    </div>
  );
}

function StreetView({ data }: { data: PropertyDetailData }) {
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const nudge = (dx: number, dy: number) => setOffset((o) => ({ x: Math.max(-20, Math.min(20, o.x + dx)), y: Math.max(-20, Math.min(20, o.y + dy)) }));
  return (
    <Card className="overflow-hidden">
      <div
        className="relative flex h-44 items-center justify-center bg-gradient-to-br from-slate-200 to-slate-300"
        style={{ backgroundPosition: `${50 + offset.x}% ${50 + offset.y}%`, backgroundSize: "140%", backgroundImage: "repeating-linear-gradient(45deg, rgba(255,255,255,.25) 0 12px, transparent 12px 24px)" }}
      >
        <span className="flex flex-col items-center text-slate-600">
          <span className="text-3xl">📍</span>
          <span className="text-xs font-medium">Street view</span>
        </span>
      </div>
      <div className="space-y-2 p-4">
        <p className="text-sm font-medium text-slate-800">{data.address.line1}</p>
        {data.address.line2 ? <p className="text-sm text-slate-600">{data.address.line2}</p> : null}
        <p className="text-sm text-slate-600">{data.address.city}, {data.address.postcode}</p>
        <div className="flex items-center justify-between pt-1">
          <span className="text-xs text-slate-400">Camera position</span>
          <div className="flex items-center gap-1">
            <Cam onClick={() => nudge(0, -5)}>↑</Cam>
            <Cam onClick={() => nudge(0, 5)}>↓</Cam>
            <Cam onClick={() => nudge(-5, 0)}>←</Cam>
            <Cam onClick={() => nudge(5, 0)}>→</Cam>
            <Cam onClick={() => setOffset({ x: 0, y: 0 })}>⟲</Cam>
          </div>
        </div>
      </div>
    </Card>
  );
}
function Cam({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return <button onClick={onClick} className="flex h-7 w-7 items-center justify-center rounded border border-slate-200 text-sm text-slate-600 hover:bg-slate-100">{children}</button>;
}

function HeaderMetrics({ data }: { data: PropertyDetailData }) {
  const m = data.metrics;
  return (
    <Card className="p-5">
      <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <Metric label="Rental income" value={m.rentPence ? `${gbp(m.rentPence)} / mo` : "—"} />
        <Metric label="Annual yield" value={m.annualYieldPercent != null ? `${m.annualYieldPercent}%` : "—"} />
        <Metric label="Mortgage balance" value={m.mortgageBalancePence != null ? gbp(m.mortgageBalancePence) : "—"} />
        <Metric label="Valuation" value={m.valuationPence != null ? gbp(m.valuationPence) : "—"} />
        <Metric label="Purchase price" value={m.purchasePricePence != null ? gbp(m.purchasePricePence) : "—"} sub={data.purchaseDate ? `bought ${formatDate(data.purchaseDate)}` : undefined} />
        <Metric label="Loan to value" value={m.ltvPercent != null ? `${m.ltvPercent}%` : "—"} />
      </dl>
      <div className="mt-4 border-t border-slate-100 pt-4">
        <PortfolioEditor id={data.id} portfolioId={data.portfolioId} portfolios={data.portfolios} />
      </div>
    </Card>
  );
}

function Metric({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</dt>
      <dd className="mt-0.5 text-lg font-bold tracking-tight text-slate-900">{value}</dd>
      {sub ? <dd className="text-xs text-slate-400">{sub}</dd> : null}
    </div>
  );
}

function PortfolioEditor({ id, portfolioId, portfolios }: { id: string; portfolioId: string; portfolios: { id: string; name: string }[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <label className="flex items-center gap-3">
      <span className="text-xs font-medium uppercase tracking-wide text-slate-400">Portfolio</span>
      <select
        aria-label="Portfolio"
        className="h-9 flex-1 appearance-none rounded-lg border border-slate-300 px-3 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
        value={portfolioId}
        disabled={pending}
        onChange={(e) => { const v = e.target.value; start(async () => { await setPortfolioAction(id, v); router.refresh(); }); }}
      >
        {portfolios.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
      </select>
    </label>
  );
}

function ProfitLoss({ data }: { data: PropertyDetailData }) {
  const p = data.pnl12m;
  return (
    <Card>
      <CardHeader title="Profit & Loss analysis" subtitle="Last 12 months" />
      {!p.hasData ? (
        <div className="flex flex-col items-center px-5 py-8 text-center">
          <p className="text-sm font-semibold text-slate-900">Understand this property</p>
          <p className="mt-1 max-w-xs text-sm text-slate-500">Track income and expenses for this property to see its profit.</p>
          <Link href="/transactions" className="mt-3 inline-flex rounded-pill bg-brand-600 px-3.5 py-1.5 text-sm font-medium text-white hover:bg-brand-700">Start now</Link>
        </div>
      ) : (
        <div className="relative p-5">
          <div className={data.gated ? "pointer-events-none select-none blur-[3px]" : ""} aria-hidden={data.gated}>
            <div className="grid grid-cols-3 gap-3 text-center">
              <PnlFigure label="Income" value={gbp(p.incomePence)} tone="income" />
              <PnlFigure label="Expenses" value={gbp(p.expensesPence)} tone="expense" />
              <PnlFigure label="Profit" value={gbp(p.profitPence)} tone={p.profitPence >= 0 ? "income" : "expense"} />
            </div>
          </div>
          {data.gated ? (
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="inline-flex items-center gap-1.5 rounded-pill bg-brand-600 px-3 py-1 text-xs font-bold uppercase tracking-wider text-white shadow"><LockIcon width={13} height={13} /> Subscribe to unlock</span>
            </div>
          ) : null}
        </div>
      )}
    </Card>
  );
}
function PnlFigure({ label, value, tone }: { label: string; value: string; tone: "income" | "expense" }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</p>
      <p className={`mt-0.5 text-xl font-bold ${tone === "income" ? "text-emerald-600" : "text-slate-700"}`}>{value}</p>
    </div>
  );
}

function FinancialInfo({ data }: { data: PropertyDetailData }) {
  const m = data.mortgage;
  return (
    <Card>
      <CardHeader title="Financial information" />
      {m ? (
        <div className="space-y-2 p-5 text-sm">
          <Row label="Lender" value={m.lender} />
          <Row label="Balance" value={gbp(m.balancePence)} />
          <Row label="Monthly payment" value={m.monthlyPaymentPence != null ? gbp(m.monthlyPaymentPence) : "—"} />
          <Row label="Interest rate" value={m.ratePct != null ? `${m.ratePct}%` : "—"} />
          <p className="pt-1 text-xs text-slate-400">{m.ltvPercent != null ? `LTV ${m.ltvPercent}%` : ""}</p>
        </div>
      ) : (
        <p className="p-5 text-sm text-slate-500">No mortgage recorded — this property is owned outright.</p>
      )}
    </Card>
  );
}
function Row({ label, value }: { label: string; value: string }) {
  return <div className="flex items-center justify-between"><span className="text-slate-500">{label}</span><span className="font-medium text-slate-800">{value}</span></div>;
}

function TenantsWidget({ data }: { data: PropertyDetailData }) {
  const t = data.tenancy;
  return (
    <Card>
      <CardHeader
        title="Tenants"
        action={<div className="flex gap-2"><Button variant="secondary" href="/properties/tenancies">Review all</Button><Button>Add new tenancy</Button></div>}
      />
      {t ? (
        <div className="space-y-3 p-5">
          <div className="flex flex-wrap items-center gap-2">
            {t.tenants.map((name) => <Badge key={name} tone="brand">{name}</Badge>)}
            {data.tenancyTracked ? <Badge tone="success">Rent tracked</Badge> : <Badge tone="warning">Untracked</Badge>}
          </div>
          <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
            <div><dt className="text-slate-500">Rent</dt><dd className="font-medium text-slate-800">{gbp(t.rentPence)} / {t.frequency === "monthly" ? "mo" : "wk"}</dd></div>
            <div><dt className="text-slate-500">Due day</dt><dd className="font-medium text-slate-800">{t.dueDay}</dd></div>
            <div><dt className="text-slate-500">Since</dt><dd className="font-medium text-slate-800">{formatDate(t.startDate)}</dd></div>
            <div><dt className="text-slate-500">Deposit</dt><dd className="font-medium text-slate-800">{t.depositPence ? gbp(t.depositPence) : "—"}</dd></div>
          </dl>
          {t.arrearsStatus === "in_arrears" ? (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-800"><strong>In arrears:</strong> {gbp(t.arrearsPence)} outstanding{t.lastPaymentDate ? ` · last paid ${formatDate(t.lastPaymentDate)}` : ""}.</div>
          ) : <Badge tone="success">Rent up to date</Badge>}
        </div>
      ) : (
        <div className="flex flex-col items-center px-5 py-8 text-center">
          <p className="text-sm text-slate-500">No active tenancy. Add one to start tracking rent.</p>
          <div className="mt-3"><Button>Add new tenancy</Button></div>
        </div>
      )}
    </Card>
  );
}

function IncomeExpenseAnalysis({ data }: { data: PropertyDetailData }) {
  const [year, setYear] = useState(data.taxYears[0]);
  const { income, expenses } = useMemo(() => {
    const { start, end } = taxYearBounds(year);
    const rows = data.transactions.filter((t) => t.date >= start && t.date <= end);
    const group = (dir: "income" | "expense") => {
      const map = new Map<string, number>();
      for (const t of rows.filter((r) => r.direction === dir)) map.set(t.categoryLabel, (map.get(t.categoryLabel) ?? 0) + t.amountPence);
      return [...map.entries()].map(([label, amount]) => ({ label, amount })).sort((a, b) => b.amount - a.amount);
    };
    return { income: group("income"), expenses: group("expense") };
  }, [year, data.transactions]);

  return (
    <Card>
      <CardHeader
        title="Income & expenses analysis"
        subtitle="By category, per tax year"
        action={
          <select aria-label="Analysis tax year" className="h-9 appearance-none rounded-lg border border-slate-300 px-3 pr-8 text-sm outline-none focus:border-brand-500" value={year} onChange={(e) => setYear(e.target.value)}>
            {data.taxYears.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
        }
      />
      <div className="grid grid-cols-1 gap-4 p-5 sm:grid-cols-2">
        <Breakdown title="Income" rows={income} tone="income" empty="No income recorded this year." />
        <Breakdown title="Expenses" rows={expenses} tone="expense" empty="No expenses recorded this year." />
      </div>
    </Card>
  );
}
function Breakdown({ title, rows, tone, empty }: { title: string; rows: { label: string; amount: number }[]; tone: "income" | "expense"; empty: string }) {
  const total = rows.reduce((s, r) => s + r.amount, 0);
  return (
    <div>
      <div className="mb-2 flex items-center justify-between"><span className="text-xs font-semibold uppercase tracking-wide text-slate-400">{title}</span><span className={`text-sm font-bold ${tone === "income" ? "text-emerald-600" : "text-slate-700"}`}>{gbp(total)}</span></div>
      {rows.length === 0 ? <p className="text-sm text-slate-400">{empty}</p> : (
        <ul className="space-y-1.5">
          {rows.map((r) => (
            <li key={r.label} className="flex items-center justify-between gap-2 text-sm"><span className="truncate text-slate-600">{r.label}</span><span className="shrink-0 font-medium text-slate-800">{gbp(r.amount)}</span></li>
          ))}
        </ul>
      )}
    </div>
  );
}

function DocumentsWidget({ data }: { data: PropertyDetailData }) {
  return (
    <Card>
      <CardHeader title="Documents" action={<div className="flex gap-2"><Button variant="secondary" href="/files">Review all</Button><Button>Upload new</Button></div>} />
      {data.documents.length === 0 ? (
        <p className="p-5 text-sm text-slate-500">No documents stored for this property.</p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {data.documents.map((d) => (
            <li key={d.id} className="flex items-center justify-between gap-3 px-5 py-3">
              <div className="min-w-0"><p className="truncate text-sm font-medium text-slate-900">{d.typeLabel}</p><p className="truncate text-xs text-slate-500">{d.title}</p></div>
              {d.expiryDate ? <span className="shrink-0 text-xs text-slate-400">exp {formatDate(d.expiryDate)}</span> : null}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function NotesWidget({ notes: initial, author }: { notes: PropertyDetailData["notes"]; author: string }) {
  const [notes, setNotes] = useState(initial);
  const [body, setBody] = useState("");
  let seq = 0;
  function add() {
    if (!body.trim()) return;
    seq += 1;
    setNotes((n) => [{ id: `local_${n.length + seq}`, body: body.trim(), author, createdAt: "2026-06-20T12:00:00.000Z" }, ...n]);
    setBody("");
  }
  return (
    <Card>
      <CardHeader title="Notes" />
      <div className="space-y-3 p-5">
        <div className="flex gap-2">
          <input value={body} onChange={(e) => setBody(e.target.value)} placeholder="Add a note…" className="h-9 flex-1 rounded-lg border border-slate-300 px-3 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100" />
          <Button onClick={add} disabled={!body.trim()}>Add</Button>
        </div>
        {notes.length === 0 ? <p className="text-sm text-slate-400">No notes yet.</p> : (
          <ul className="space-y-3">
            {notes.map((n) => (
              <li key={n.id} className="rounded-lg bg-slate-50 px-3 py-2">
                <p className="text-sm text-slate-700">{n.body}</p>
                <p className="mt-1 text-xs text-slate-400">{n.author} · {formatDateTime(n.createdAt)}</p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Card>
  );
}

function TransactionsWidget({ rows }: { rows: DetailTx[] }) {
  return (
    <Card>
      <CardHeader title="Transactions" subtitle="Scoped to this property" action={<Button variant="secondary" href="/transactions">Open ledger</Button>} />
      {rows.length === 0 ? (
        <p className="p-5 text-sm text-slate-500">No transactions for this property yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm">
            <thead><tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-400">
              <th className="px-5 py-3 font-medium">Date</th><th className="px-5 py-3 font-medium">Description</th><th className="px-5 py-3 font-medium">Category</th><th className="px-5 py-3 text-right font-medium">Amount</th>
            </tr></thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((t) => (
                <tr key={t.id} className="hover:bg-slate-50">
                  <td className="whitespace-nowrap px-5 py-3 text-slate-600">{formatDate(t.date)}</td>
                  <td className="px-5 py-3 font-medium text-slate-900">{t.description}</td>
                  <td className="px-5 py-3 text-slate-600">{t.categoryLabel}</td>
                  <td className={`whitespace-nowrap px-5 py-3 text-right font-semibold ${t.direction === "income" ? "text-emerald-600" : "text-slate-700"}`}>{t.direction === "income" ? "+" : "−"}{formatGBP(t.amountPence)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

// --- Mortgages & Valuations tab ---------------------------------------------

function MortgagesTab({ data }: { data: PropertyDetailData }) {
  const m = data.mortgage;
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader title="Mortgage" />
        {m ? (
          <div className="space-y-2 p-5 text-sm">
            <Row label="Lender" value={m.lender} />
            <Row label="Outstanding balance" value={gbp(m.balancePence)} />
            <Row label="Monthly payment" value={m.monthlyPaymentPence != null ? gbp(m.monthlyPaymentPence) : "—"} />
            <Row label="Interest rate" value={m.ratePct != null ? `${m.ratePct}%` : "—"} />
            <Row label="Repayment type" value={m.repaymentType === "interest_only" ? "Interest only" : m.repaymentType === "repayment" ? "Repayment" : "—"} />
            <Row label="Loan to value" value={m.ltvPercent != null ? `${m.ltvPercent}%` : "—"} />
          </div>
        ) : <p className="p-5 text-sm text-slate-500">No mortgage recorded — owned outright.</p>}
      </Card>
      <Card>
        <CardHeader title="Valuations" subtitle="Drives LTV and yield" />
        {data.valuations.length === 0 ? <p className="p-5 text-sm text-slate-500">No valuations recorded.</p> : (
          <ul className="divide-y divide-slate-100">
            {data.valuations.map((v) => (
              <li key={v.id} className="flex items-center justify-between gap-3 px-5 py-3">
                <div><p className="text-sm font-semibold text-slate-900">{gbp(v.amountPence)}</p><p className="text-xs text-slate-500">{formatDate(v.date)}{v.source ? ` · ${v.source}` : ""}</p></div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

// --- EPC tab -----------------------------------------------------------------

const EPC_TONE: Record<string, string> = { A: "bg-emerald-600", B: "bg-emerald-500", C: "bg-lime-500", D: "bg-amber-500", E: "bg-orange-500", F: "bg-red-500", G: "bg-red-600" };

function EpcTab({ data }: { data: PropertyDetailData }) {
  const e = data.epc;
  return (
    <Card>
      <CardHeader title="Energy Performance Certificate" action={<Button variant="secondary" href="/files">Documents</Button>} />
      {!e ? (
        <div className="flex flex-col items-center px-5 py-10 text-center">
          <p className="text-sm font-semibold text-slate-900">No EPC on record</p>
          <p className="mt-1 max-w-sm text-sm text-slate-500">An EPC (rating A–G) is required to let a property. Upload one to track its expiry.</p>
          <div className="mt-3"><Button>Upload EPC</Button></div>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-6 p-6">
          <span className={`flex h-20 w-20 items-center justify-center rounded-xl text-4xl font-bold text-white ${EPC_TONE[e.rating] ?? "bg-slate-400"}`}>{e.rating}</span>
          <div className="space-y-1 text-sm">
            <p className="text-base font-semibold text-slate-900">Energy rating {e.rating}</p>
            {e.issueDate ? <p className="text-slate-600">Issued {formatDate(e.issueDate)}</p> : null}
            <p className="text-slate-600">Expires {formatDate(e.expiryDate)}</p>
            {e.expired ? <Badge tone="danger">Expired — renew required</Badge> : <Badge tone="success">Valid</Badge>}
          </div>
        </div>
      )}
    </Card>
  );
}
