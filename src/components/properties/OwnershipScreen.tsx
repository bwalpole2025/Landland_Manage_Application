"use client";

import { useMemo, useState } from "react";
import { Card, CardHeader, Badge, Button } from "@/components/ui";
import { Modal } from "@/components/ds/Modal";
import { Tabs } from "@/components/ds/Tabs";
import { formatGBP } from "@/lib/money";
import { formatDate } from "@/lib/dates";

const gbp = (p: number) => formatGBP(p, { showPence: false });

export interface PortfolioRow {
  id: string;
  name: string;
  type: "personal" | "business";
  isDefault: boolean;
  companyName?: string;
  propertyCount: number;
  ownerCount: number;
}
export interface OwnerSplit { incomePence: number; expensesPence: number; profitPence: number; estimatedTaxPence: number }
export interface OwnerRow {
  id: string;
  name: string;
  holdings: { propertyId: string; propertyName: string; sharePercent: number }[];
  split: OwnerSplit;
}
export interface CompanyRow {
  id: string;
  name: string;
  companyNumber?: string;
  incorporationDate?: string;
  directorsLoanBalancePence: number;
  portfolioName?: string;
  propertyCount: number;
}

export interface OwnershipScreenProps {
  portfolios: PortfolioRow[];
  owners: OwnerRow[];
  companies: CompanyRow[];
  properties: { id: string; name: string }[];
  /** propertyId → portfolioId, for the "Select property" filter. */
  propertyPortfolio: Record<string, string>;
  taxYear: string;
}

const selectClass = "h-10 appearance-none rounded-lg border border-slate-300 bg-white pl-3 pr-9 text-sm text-slate-900 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100";

export function OwnershipScreen({ portfolios, owners, companies, properties, propertyPortfolio, taxYear }: OwnershipScreenProps) {
  const [tab, setTab] = useState("portfolios");
  const [property, setProperty] = useState("");
  const [owner, setOwner] = useState("");
  const [sort, setSort] = useState("name");
  const [add, setAdd] = useState<null | "Portfolio" | "Beneficial Owner" | "Company">(null);

  const sortByName = <T extends { name: string }>(xs: T[]) => (sort === "name" ? [...xs].sort((a, b) => a.name.localeCompare(b.name)) : xs);

  const visibleOwners = useMemo(() => {
    let list = owners;
    if (owner) list = list.filter((o) => o.id === owner);
    if (property) list = list.filter((o) => o.holdings.some((h) => h.propertyId === property));
    return sortByName(list);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [owners, owner, property, sort]);

  const visiblePortfolios = useMemo(() => {
    // Narrow to the portfolio that contains the selected property.
    const list = property ? portfolios.filter((pf) => pf.id === propertyPortfolio[property]) : portfolios;
    return sortByName(list);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [portfolios, property, sort]);

  return (
    <>
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Ownership</h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-500">Who owns what — so tax can be split pro-rata across portfolios, owners and companies.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="secondary" onClick={() => setAdd("Portfolio")}>Add Portfolio</Button>
          <Button variant="secondary" onClick={() => setAdd("Beneficial Owner")}>Add Beneficial Owner</Button>
          <Button onClick={() => setAdd("Company")}>Add Company</Button>
        </div>
      </div>

      <Tabs
        value={tab}
        onChange={setTab}
        items={[
          { id: "portfolios", label: "Portfolios", badge: portfolios.length },
          { id: "owners", label: "Beneficial Owners", badge: owners.length },
          { id: "companies", label: "Companies", badge: companies.length },
        ]}
      />

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <select aria-label="Select property" className={selectClass} value={property} onChange={(e) => setProperty(e.target.value)}>
          <option value="">All properties</option>
          {properties.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <select aria-label="Select beneficial owner" className={selectClass} value={owner} onChange={(e) => setOwner(e.target.value)}>
          <option value="">All beneficial owners</option>
          {owners.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
        </select>
        <select aria-label="Sort" className={selectClass} value={sort} onChange={(e) => setSort(e.target.value)}>
          <option value="name">Name A–Z</option>
          <option value="none">Default order</option>
        </select>
      </div>

      {tab === "portfolios" ? <PortfoliosTab rows={visiblePortfolios} /> : null}
      {tab === "owners" ? <OwnersTab rows={visibleOwners} taxYear={taxYear} /> : null}
      {tab === "companies" ? <CompaniesTab rows={companies} /> : null}

      <AddModal kind={add} onClose={() => setAdd(null)} />
    </>
  );
}

function PortfoliosTab({ rows }: { rows: PortfolioRow[] }) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      {rows.map((pf) => (
        <Card key={pf.id} className="p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="font-semibold text-slate-900">{pf.name}</h3>
              {pf.companyName ? <p className="text-sm text-slate-500">Held via {pf.companyName}</p> : null}
            </div>
            <Badge tone={pf.type === "business" ? "info" : "neutral"}>{pf.type === "business" ? "Business" : "Personal"}</Badge>
          </div>
          <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
            <div><dt className="text-slate-500">Properties</dt><dd className="text-lg font-bold text-slate-900">{pf.propertyCount}</dd></div>
            <div><dt className="text-slate-500">Beneficial owners</dt><dd className="text-lg font-bold text-slate-900">{pf.ownerCount}</dd></div>
          </dl>
          {pf.isDefault ? (
            <p className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500">
              Default portfolio — transactions tracked without a property are assigned here.
            </p>
          ) : null}
        </Card>
      ))}
    </div>
  );
}

function OwnersTab({ rows, taxYear }: { rows: OwnerRow[]; taxYear: string }) {
  if (rows.length === 0) return <Card className="px-6 py-12 text-center text-sm text-slate-500">No beneficial owners match these filters.</Card>;
  return (
    <div className="space-y-4">
      {rows.map((o) => (
        <Card key={o.id}>
          <CardHeader
            title={o.name}
            subtitle={`Holds ${o.holdings.length} ${o.holdings.length === 1 ? "property" : "properties"}`}
          />
          <div className="grid grid-cols-1 gap-4 p-5 lg:grid-cols-2">
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Holdings</p>
              <ul className="space-y-1.5">
                {o.holdings.map((h) => (
                  <li key={h.propertyId} className="flex items-center justify-between gap-2 text-sm">
                    <span className="truncate text-slate-700">{h.propertyName}</span>
                    <Badge tone="brand">{h.sharePercent}%</Badge>
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-lg bg-slate-50 p-4">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Pro-rata tax statement · {taxYear}</p>
              <dl className="grid grid-cols-2 gap-3 text-sm">
                <Split label="Income" value={gbp(o.split.incomePence)} tone="income" />
                <Split label="Expenses" value={gbp(o.split.expensesPence)} tone="expense" />
                <Split label="Taxable profit" value={gbp(o.split.profitPence)} />
                <Split label="Estimated tax" value={gbp(o.split.estimatedTaxPence)} tone="warning" />
              </dl>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}
function Split({ label, value, tone = "default" }: { label: string; value: string; tone?: "income" | "expense" | "warning" | "default" }) {
  const cls = tone === "income" ? "text-emerald-600" : tone === "warning" ? "text-amber-700" : "text-slate-900";
  return <div><dt className="text-xs text-slate-500">{label}</dt><dd className={`text-base font-bold ${cls}`}>{value}</dd></div>;
}

function CompaniesTab({ rows }: { rows: CompanyRow[] }) {
  if (rows.length === 0) return <Card className="px-6 py-12 text-center text-sm text-slate-500">No companies yet. Add a limited company to track directors&apos; loans.</Card>;
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      {rows.map((c) => (
        <Card key={c.id} className="p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="font-semibold text-slate-900">{c.name}</h3>
              <p className="text-sm text-slate-500">{c.companyNumber ? `Company no. ${c.companyNumber}` : "Limited company"}{c.incorporationDate ? ` · inc. ${formatDate(c.incorporationDate)}` : ""}</p>
            </div>
            <Badge tone="info">Ltd</Badge>
          </div>
          <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
            <div><dt className="text-slate-500">Portfolio</dt><dd className="font-medium text-slate-800">{c.portfolioName ?? "—"}</dd></div>
            <div><dt className="text-slate-500">Properties</dt><dd className="font-medium text-slate-800">{c.propertyCount}</dd></div>
          </dl>
          <div className="mt-3 flex items-center justify-between rounded-lg bg-brand-50 px-3 py-2">
            <span className="text-sm text-slate-600">Directors&apos; loan balance</span>
            <span className="text-sm font-bold text-brand-800">{gbp(c.directorsLoanBalancePence)}</span>
          </div>
        </Card>
      ))}
    </div>
  );
}

function AddModal({ kind, onClose }: { kind: null | "Portfolio" | "Beneficial Owner" | "Company"; onClose: () => void }) {
  return (
    <Modal
      open={kind != null}
      onClose={onClose}
      title={kind ? `Add ${kind}` : ""}
      size="sm"
      footer={<div className="flex w-full justify-end gap-2"><Button variant="secondary" onClick={onClose}>Cancel</Button><Button onClick={onClose}>Save</Button></div>}
    >
      <div className="space-y-3">
        <Labeled label={kind === "Beneficial Owner" ? "Owner name" : `${kind ?? ""} name`}><input className="input" placeholder="Name" /></Labeled>
        {kind === "Beneficial Owner" ? <Labeled label="Ownership share (%)"><input type="number" min={0} max={100} className="input" placeholder="50" /></Labeled> : null}
        {kind === "Portfolio" ? (
          <Labeled label="Type">
            <select className="input"><option>Personal</option><option>Business</option></select>
          </Labeled>
        ) : null}
        {kind === "Company" ? <Labeled label="Company number"><input className="input" placeholder="12345678" /></Labeled> : null}
      </div>
    </Modal>
  );
}
function Labeled({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="mb-1 block text-sm font-medium text-slate-700">{label}</span>{children}</label>;
}
