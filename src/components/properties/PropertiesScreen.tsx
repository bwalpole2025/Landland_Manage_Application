"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Card, Badge, Button } from "@/components/ui";
import { Tabs } from "@/components/ds/Tabs";
import { PropertyIcon, ChevronRightIcon, LockIcon, PlusIcon } from "@/components/icons";
import { AddPropertyModal, type AddedProperty } from "./AddPropertyModal";
import { PROPERTY_TYPE_LABELS } from "@/lib/labels";
import { formatGBP } from "@/lib/money";
import { taxYearBounds, formatDate } from "@/lib/dates";
import type { PropertyFigures } from "@/lib/properties";

export interface PropertyCardData {
  id: string;
  nickname: string;
  addressLine: string;
  typeLabel: string;
  bedrooms: number;
  portfolioId: string;
  portfolioName: string;
  occupied: boolean;
  rentPence: number;
  figuresByYear: Record<string, PropertyFigures>;
}

export interface InsuranceRow {
  id: string;
  propertyId: string;
  propertyName: string;
  portfolioId: string;
  typeLabel: string;
  provider: string;
  expiryDate: string;
  expired: boolean;
}

export interface MortgageRow {
  id: string;
  propertyId: string;
  propertyName: string;
  portfolioId: string;
  lender: string;
  balancePence: number;
  monthlyPaymentPence: number | null;
  ratePct: number | null;
  ltvPercent: number | null;
}

export interface SummaryData {
  portfolioCount: number;
  propertyCount: number;
  activeTenancyCount: number;
  vacantCount: number;
  arrearsPence: number;
  creditPence: number;
}

export interface PropertiesScreenProps {
  summary: SummaryData;
  portfolios: { id: string; name: string }[];
  taxYears: string[];
  cards: PropertyCardData[];
  insurance: InsuranceRow[];
  mortgages: MortgageRow[];
  /** True during the trial — gates the per-tax-year figures behind SUBSCRIBE. */
  gated: boolean;
}

const gbp = (p: number) => formatGBP(p, { showPence: false });

export function PropertiesScreen({ summary, portfolios, taxYears, cards, insurance, mortgages, gated }: PropertiesScreenProps) {
  const [tab, setTab] = useState("properties");
  const [portfolio, setPortfolio] = useState("");
  const [taxYear, setTaxYear] = useState(taxYears[0]);
  const [sort, setSort] = useState("name");
  const [addOpen, setAddOpen] = useState(false);
  // Optimistically-added properties (the server action persists them too).
  const [extraCards, setExtraCards] = useState<PropertyCardData[]>([]);

  const allCards = useMemo(() => {
    const seen = new Set(cards.map((c) => c.id));
    return [...cards, ...extraCards.filter((c) => !seen.has(c.id))];
  }, [cards, extraCards]);

  const byPortfolio = <T extends { portfolioId: string }>(items: T[]) =>
    portfolio ? items.filter((i) => i.portfolioId === portfolio) : items;

  const onPropertyAdded = (p: AddedProperty) => {
    const zero = { incomePence: 0, expensesPence: 0, profitPence: 0, arrearsPence: 0 };
    const figuresByYear = Object.fromEntries(taxYears.map((y) => [y, zero]));
    setExtraCards((prev) => [
      ...prev,
      {
        id: p.id,
        nickname: p.nickname,
        addressLine: `${p.line1}, ${p.city} ${p.postcode}`,
        typeLabel: PROPERTY_TYPE_LABELS[p.type],
        bedrooms: p.bedrooms,
        portfolioId: p.portfolioId || portfolios[0]?.id || "",
        portfolioName: portfolios.find((x) => x.id === p.portfolioId)?.name ?? portfolios[0]?.name ?? "Portfolio",
        occupied: false,
        rentPence: 0,
        figuresByYear,
      },
    ]);
  };

  const visibleCards = useMemo(() => {
    const list = byPortfolio(allCards);
    return [...list].sort((a, b) =>
      sort === "name" ? a.nickname.localeCompare(b.nickname) : b.rentPence - a.rentPence,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allCards, portfolio, sort]);

  const visibleInsurance = byPortfolio(insurance);
  const visibleMortgages = byPortfolio(mortgages);
  const taxYearStart = formatDate(taxYearBounds(taxYear).start);

  return (
    <>
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Properties</h1>
          <p className="mt-1 text-sm text-slate-500">Your portfolio at a glance — income, expenses and compliance per property.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary">Import Properties</Button>
          <Button onClick={() => setAddOpen(true)}>Add Property</Button>
        </div>
      </div>

      <AddPropertyModal open={addOpen} onClose={() => setAddOpen(false)} portfolios={portfolios} onAdded={onPropertyAdded} />

      {/* Summary metric cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Metric label="Portfolios" value={String(summary.portfolioCount)} action={<MetricAction>+ Add Portfolio</MetricAction>} />
        <Metric label="Properties" value={String(summary.propertyCount)} action={<MetricAction>+ Add Property</MetricAction>} />
        <Metric
          label="Tenancies"
          value={String(summary.activeTenancyCount)}
          sub={<span className={summary.vacantCount > 0 ? "text-amber-600" : "text-slate-400"}>{summary.vacantCount} vacant</span>}
        />
        <Metric
          label="Credit & Arrears"
          value={gbp(summary.arrearsPence)}
          sub={<span className="text-slate-400">{gbp(summary.creditPence)} in credit</span>}
          valueTone={summary.arrearsPence > 0 ? "danger" : "default"}
          action={<Link href="/transactions" className="text-xs font-medium text-brand-700 hover:text-brand-800">Add Transactions</Link>}
        />
      </div>

      {/* Tabs */}
      <Tabs
        value={tab}
        onChange={setTab}
        items={[
          { id: "properties", label: "Properties", badge: summary.propertyCount },
          { id: "insurance", label: "Insurance", badge: insurance.length },
          { id: "mortgages", label: "Mortgages", badge: mortgages.length },
        ]}
      />

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <select aria-label="Select Portfolio" className={selectClass} value={portfolio} onChange={(e) => setPortfolio(e.target.value)}>
          <option value="">All portfolios</option>
          {portfolios.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        {tab === "properties" ? (
          <>
            <select aria-label="Tax year" className={selectClass} value={taxYear} onChange={(e) => setTaxYear(e.target.value)}>
              {taxYears.map((y) => <option key={y} value={y}>Tax year {y}</option>)}
            </select>
            <select aria-label="Sort" className={selectClass} value={sort} onChange={(e) => setSort(e.target.value)}>
              <option value="name">Name A–Z</option>
              <option value="rent">Rent (high–low)</option>
            </select>
          </>
        ) : null}
      </div>

      {/* Tab content */}
      {tab === "properties" ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {visibleCards.map((c) => (
            <PropertyCard key={c.id} card={c} taxYear={taxYear} taxYearStart={taxYearStart} gated={gated} />
          ))}
        </div>
      ) : null}

      {tab === "insurance" ? <InsuranceTable rows={visibleInsurance} /> : null}
      {tab === "mortgages" ? <MortgageTable rows={visibleMortgages} /> : null}
    </>
  );
}

const selectClass =
  "h-10 appearance-none rounded-lg border border-slate-300 bg-white pl-3 pr-9 text-sm text-slate-900 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100";

function Metric({ label, value, sub, action, valueTone = "default" }: { label: string; value: string; sub?: React.ReactNode; action?: React.ReactNode; valueTone?: "default" | "danger" }) {
  return (
    <Card className="p-5">
      <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">{label}</div>
      <div className={`mt-2 text-2xl font-bold tracking-tight ${valueTone === "danger" ? "text-red-600" : "text-slate-900"}`}>{value}</div>
      <div className="mt-1 flex items-center justify-between gap-2 text-sm">
        <span>{sub}</span>
        {action}
      </div>
    </Card>
  );
}

function MetricAction({ children }: { children: React.ReactNode }) {
  return <button className="text-xs font-medium text-brand-700 hover:text-brand-800">{children}</button>;
}

function PropertyCard({ card, taxYear, taxYearStart, gated }: { card: PropertyCardData; taxYear: string; taxYearStart: string; gated: boolean }) {
  const f = card.figuresByYear[taxYear] ?? { incomePence: 0, expensesPence: 0, profitPence: 0, arrearsPence: 0 };
  return (
    <Link href={`/properties/${card.id}`}>
      <Card className="h-full p-5 transition hover:border-brand-300 hover:shadow-md">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-50 text-brand-600"><PropertyIcon /></span>
            <div>
              <h3 className="font-semibold text-slate-900">{card.nickname}</h3>
              <p className="text-sm text-slate-500">{card.addressLine}</p>
            </div>
          </div>
          <ChevronRightIcon className="shrink-0 text-slate-300" />
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Badge tone={card.occupied ? "brand" : "neutral"}>{card.occupied ? "Occupied" : "Vacant"}</Badge>
          <span className="text-sm text-slate-600">{card.rentPence ? `${gbp(card.rentPence)} monthly` : "No rent set"}</span>
        </div>

        <p className="mt-2 text-xs text-slate-400">
          {card.portfolioName} · Tax year {taxYear} from {taxYearStart}
        </p>

        {/* Per-tax-year figures — gated during the trial */}
        <div className="relative mt-3 border-t border-slate-100 pt-3">
          <div className={gated ? "pointer-events-none select-none blur-[3px]" : ""} aria-hidden={gated}>
            <dl className="grid grid-cols-4 gap-2 text-center">
              <Figure label="Income" value={gbp(f.incomePence)} tone="income" />
              <Figure label="Expenses" value={gbp(f.expensesPence)} tone="expense" />
              <Figure label="Profit" value={gbp(f.profitPence)} tone={f.profitPence >= 0 ? "income" : "expense"} />
              <Figure label="Arrears" value={gbp(f.arrearsPence)} tone={f.arrearsPence > 0 ? "expense" : "muted"} />
            </dl>
          </div>
          {gated ? (
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="inline-flex items-center gap-1.5 rounded-pill bg-brand-600 px-3 py-1 text-xs font-bold uppercase tracking-wider text-white shadow">
                <LockIcon width={13} height={13} /> Subscribe
              </span>
            </div>
          ) : null}
        </div>
      </Card>
    </Link>
  );
}

function Figure({ label, value, tone }: { label: string; value: string; tone: "income" | "expense" | "muted" }) {
  const cls = tone === "income" ? "text-emerald-600" : tone === "expense" ? "text-slate-700" : "text-slate-400";
  return (
    <div>
      <dd className={`text-sm font-bold tabular-nums ${cls}`}>{value}</dd>
      <dt className="text-[11px] uppercase tracking-wide text-slate-400">{label}</dt>
    </div>
  );
}

function InsuranceTable({ rows }: { rows: InsuranceRow[] }) {
  if (rows.length === 0) return <Empty icon={<PlusIcon />} message="No insurance policies recorded." />;
  return (
    <Card>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-400">
              <th className="px-5 py-3 font-medium">Property</th>
              <th className="px-5 py-3 font-medium">Type</th>
              <th className="px-5 py-3 font-medium">Provider</th>
              <th className="px-5 py-3 font-medium">Expiry</th>
              <th className="px-5 py-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((r) => (
              <tr key={r.id} className="hover:bg-slate-50">
                <td className="px-5 py-3">
                  <Link href={`/properties/${r.propertyId}`} className="font-medium text-brand-700 hover:text-brand-800">{r.propertyName}</Link>
                </td>
                <td className="px-5 py-3 text-slate-600">{r.typeLabel}</td>
                <td className="px-5 py-3 text-slate-600">{r.provider}</td>
                <td className="px-5 py-3 text-slate-600">{formatDate(r.expiryDate)}</td>
                <td className="px-5 py-3">
                  {r.expired ? <Badge tone="danger">Expired</Badge> : <Badge tone="success">Active</Badge>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function MortgageTable({ rows }: { rows: MortgageRow[] }) {
  if (rows.length === 0) return <Empty icon={<PlusIcon />} message="No mortgages recorded — these properties are owned outright." />;
  return (
    <Card>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-sm">
          <thead>
            <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-400">
              <th className="px-5 py-3 font-medium">Property</th>
              <th className="px-5 py-3 font-medium">Lender</th>
              <th className="px-5 py-3 text-right font-medium">Balance</th>
              <th className="px-5 py-3 text-right font-medium">Monthly</th>
              <th className="px-5 py-3 text-right font-medium">Rate</th>
              <th className="px-5 py-3 text-right font-medium">LTV</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((r) => (
              <tr key={r.id} className="hover:bg-slate-50">
                <td className="px-5 py-3">
                  <Link href={`/properties/${r.propertyId}`} className="font-medium text-brand-700 hover:text-brand-800">{r.propertyName}</Link>
                </td>
                <td className="px-5 py-3 text-slate-600">{r.lender}</td>
                <td className="px-5 py-3 text-right font-medium text-slate-800">{gbp(r.balancePence)}</td>
                <td className="px-5 py-3 text-right text-slate-600">{r.monthlyPaymentPence != null ? gbp(r.monthlyPaymentPence) : "—"}</td>
                <td className="px-5 py-3 text-right text-slate-600">{r.ratePct != null ? `${r.ratePct}%` : "—"}</td>
                <td className="px-5 py-3 text-right font-semibold text-slate-800">{r.ltvPercent != null ? `${r.ltvPercent}%` : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function Empty({ message }: { icon: React.ReactNode; message: string }) {
  return (
    <Card className="flex flex-col items-center justify-center px-6 py-12 text-center text-sm text-slate-500">
      {message}
    </Card>
  );
}
