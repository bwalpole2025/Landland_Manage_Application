"use client";

import { useEffect, useMemo, useState } from "react";
import { Card, CardHeader, StatTile, Badge, Button, Disclaimer } from "@/components/ui";
import { Modal } from "@/components/ds/Modal";
import { LockIcon } from "@/components/icons";
import { formatGBP } from "@/lib/money";
import type { TaxEstimate } from "@/lib/types";

export interface OwnerEstimate { ownerId: string; name: string; estimate: TaxEstimate }
export interface YearStatement { taxYear: string; total: TaxEstimate; owners: OwnerEstimate[] }

export interface TaxStatementsProps {
  userId: string;
  currentTaxYear: string;
  statements: YearStatement[]; // one per available tax year
  owners: { id: string; name: string }[];
  disclaimer: string;
}

const ACK_PREFIX = "landland.tax.acknowledged.";

export function TaxStatements({ userId, currentTaxYear, statements, owners, disclaimer }: TaxStatementsProps) {
  const ackKey = ACK_PREFIX + userId;
  const [accepted, setAccepted] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try { if (localStorage.getItem(ackKey) === "1") setAccepted(true); } catch { /* ignore */ }
    setReady(true);
  }, [ackKey]);

  function accept() {
    try { localStorage.setItem(ackKey, "1"); } catch { /* ignore */ }
    setAccepted(true);
  }

  return (
    <>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Tax Statements</h1>
        <p className="mt-1 max-w-2xl text-sm text-slate-500">
          Keep tabs on your upcoming tax bill — and share estimates with business partners, assistants
          and advisors. Filter by owner to see each person&apos;s pro-rata share.
        </p>
      </div>

      {!ready ? null : !accepted ? (
        <AcknowledgementGate disclaimer={disclaimer} onAccept={accept} />
      ) : (
        <StatementsArea currentTaxYear={currentTaxYear} statements={statements} owners={owners} disclaimer={disclaimer} />
      )}
    </>
  );
}

function AcknowledgementGate({ disclaimer, onAccept }: { disclaimer: string; onAccept: () => void }) {
  const [ack1, setAck1] = useState(false);
  const [ack2, setAck2] = useState(false);
  return (
    <Card className="mx-auto max-w-2xl p-6">
      <div className="flex items-center gap-2 text-amber-700">
        <span aria-hidden>⚠️</span>
        <h2 className="text-base font-semibold">Before you continue</h2>
      </div>
      <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">{disclaimer}</div>

      <div className="mt-5 space-y-3">
        <label className="flex items-start gap-3 text-sm text-slate-700">
          <input type="checkbox" className="mt-0.5 h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500" checked={ack1} onChange={(e) => setAck1(e.target.checked)} />
          <span>I understand these figures are an <strong>estimate for guidance only and not tax advice</strong>.</span>
        </label>
        <label className="flex items-start gap-3 text-sm text-slate-700">
          <input type="checkbox" className="mt-0.5 h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500" checked={ack2} onChange={(e) => setAck2(e.target.checked)} />
          <span>I understand the figures <strong>depend on my transactions being correctly categorised</strong>.</span>
        </label>
      </div>

      <div className="mt-6 flex items-center gap-3">
        <Button onClick={onAccept} disabled={!ack1 || !ack2}>Continue to statements</Button>
        {!ack1 || !ack2 ? <span className="text-xs text-slate-400">Confirm both to continue.</span> : null}
      </div>
    </Card>
  );
}

const gbp = (p: number) => formatGBP(p, { showPence: false });

const BAND_LABEL: Record<string, string> = {
  none: "within personal allowance",
  basic: "basic rate",
  higher: "higher rate",
  additional: "additional rate",
};

function StatementsArea({ currentTaxYear, statements, owners, disclaimer }: { currentTaxYear: string; statements: YearStatement[]; owners: { id: string; name: string }[]; disclaimer: string }) {
  const [createdYears, setCreatedYears] = useState<string[]>([currentTaxYear]);
  const [selectedYear, setSelectedYear] = useState(currentTaxYear);
  const [ownerId, setOwnerId] = useState(""); // "" = all owners
  const [createOpen, setCreateOpen] = useState(false);

  const available = statements.map((s) => s.taxYear);
  const uncreated = available.filter((y) => !createdYears.includes(y));

  const statement = useMemo(() => statements.find((s) => s.taxYear === selectedYear), [statements, selectedYear]);
  const estimate: TaxEstimate | undefined = useMemo(() => {
    if (!statement) return undefined;
    return ownerId ? statement.owners.find((o) => o.ownerId === ownerId)?.estimate : statement.total;
  }, [statement, ownerId]);

  function create(year: string) {
    setCreatedYears((ys) => (ys.includes(year) ? ys : [...ys, year].sort().reverse()));
    setSelectedYear(year);
    setCreateOpen(false);
  }

  return (
    <>
      <Disclaimer>{disclaimer}</Disclaimer>

      {/* Statements (one per tax year) */}
      <Card>
        <CardHeader title="Your tax statements" subtitle="One statement per tax year" action={<Button onClick={() => setCreateOpen(true)} disabled={uncreated.length === 0}>Create new tax statement</Button>} />
        <div className="flex flex-wrap gap-2 p-4">
          {createdYears.map((y) => (
            <button key={y} onClick={() => setSelectedYear(y)} className={`rounded-pill px-3.5 py-1.5 text-sm font-medium ring-1 ring-inset transition ${selectedYear === y ? "bg-brand-600 text-white ring-brand-600" : "bg-white text-slate-700 ring-slate-300 hover:bg-slate-50"}`}>
              Tax year {y}{y === currentTaxYear ? " · current" : ""}
            </button>
          ))}
        </div>
      </Card>

      {/* Owner filter */}
      {owners.length > 1 ? (
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Filter by owner</p>
          <div className="flex flex-wrap gap-2">
            <OwnerChip active={ownerId === ""} onClick={() => setOwnerId("")}>All owners</OwnerChip>
            {owners.map((o) => <OwnerChip key={o.id} active={ownerId === o.id} onClick={() => setOwnerId(o.id)}>{o.name}</OwnerChip>)}
          </div>
        </div>
      ) : null}

      {/* Figures for the selected statement + owner */}
      {estimate ? (
        <>
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <Badge tone="neutral">Tax year {selectedYear}</Badge>
            <Badge tone={ownerId ? "brand" : "neutral"}>{ownerId ? owners.find((o) => o.id === ownerId)?.name : "Whole account"}</Badge>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatTile label="Total income" value={gbp(estimate.totalIncomePence)} tone="success" />
            <StatTile label="Total expenses" value={gbp(estimate.totalExpensesPence)} />
            <StatTile label="Taxable profit" value={gbp(estimate.taxableProfitPence)} tone="brand" />
            <StatTile label="Estimated tax" value={gbp(estimate.estimatedTaxPence)} sub="estimate · not advice" tone="warning" />
          </div>

          {/* SA105-structured taxable rental income */}
          <Card>
            <CardHeader title="Taxable rental income (SA105)" subtitle="Allowable income less allowable expenses" />
            <div className="p-5 text-sm">
              <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">Income</p>
              <Line label="Rents received (box 20)" value={gbp(estimate.income.rentsReceivedPence)} />
              <Line label="Lease premiums (box 22)" value={gbp(estimate.income.premiumsPence)} />
              <Line label="Other property income (box 20)" value={gbp(estimate.income.otherIncomePence)} />
              <Line label="Total income" value={gbp(estimate.totalIncomePence)} strong />

              <p className="mb-1.5 mt-4 text-xs font-semibold uppercase tracking-wide text-slate-400">Allowable expenses</p>
              {estimate.allowableExpenses.length === 0 ? <p className="text-slate-400">No allowable expenses recorded.</p> : null}
              {estimate.allowableExpenses.map((e) => <Line key={e.category} label={`${e.label} (box ${e.sa105Box})`} value={`(${gbp(e.amountPence)})`} />)}

              <div className="mt-3 border-t border-slate-100 pt-3">
                <Line label="Taxable rental profit" value={gbp(estimate.taxableProfitPence)} strong />
                <Line label="Residential finance costs (box 44 — relieved, not deducted)" value={gbp(estimate.financeCostsPence)} muted />
                <Line label="Finance-cost tax reducer (basic rate)" value={`− ${gbp(estimate.financeReliefPence)}`} />
                <div className="mt-2 flex items-center justify-between rounded-lg bg-amber-50 px-3 py-2">
                  <span className="font-medium text-amber-900">Estimated tax · {selectedYear} · {BAND_LABEL[estimate.taxBand]}</span>
                  <span className="font-bold text-amber-900">{gbp(estimate.estimatedTaxPence)}</span>
                </div>
              </div>
            </div>
          </Card>

          <Card>
            <CardHeader title="SA105 box breakdown" subtitle="Your categorised transactions aggregated into the SA105 box numbers" />
            {estimate.boxes.length === 0 ? (
              <p className="px-5 py-8 text-center text-sm text-slate-500">No categorised transactions for {selectedYear}{ownerId ? " for this owner" : ""} yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[560px] text-sm">
                  <thead><tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-400">
                    <th className="px-5 py-3 font-medium">Box</th><th className="px-5 py-3 font-medium">Description</th><th className="px-5 py-3 text-right font-medium">Amount</th>
                  </tr></thead>
                  <tbody className="divide-y divide-slate-100">
                    {estimate.boxes.map((box) => (
                      <tr key={box.box} className="hover:bg-slate-50">
                        <td className="px-5 py-3 font-mono text-slate-500">{box.box}</td>
                        <td className="px-5 py-3 text-slate-800">{box.label}</td>
                        <td className="px-5 py-3 text-right font-semibold text-slate-900">{formatGBP(box.amountPence)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          <Card>
            <CardHeader title="How this estimate works" />
            <div className="space-y-2 p-5 text-sm text-slate-600">
              <p>Profit is income (box 20) less allowable expenses (boxes 24–29). Residential <strong>finance costs</strong> such as mortgage interest (box 44, {gbp(estimate.financeCostsPence)}) are not deducted from profit — instead they attract a <strong>basic-rate tax reducer</strong> of {gbp(estimate.financeReliefPence)}.</p>
              <p>Rates &amp; allowances applied from the <strong>{estimate.appliedTaxYear}</strong> ruleset; tax is banded (basic / higher / additional) after the personal allowance.</p>
              <p className="flex items-center gap-1.5 text-slate-500"><LockIcon width={14} height={14} /> A simplified forecast — it doesn&apos;t account for your other income, allowances or reliefs. Always confirm with a qualified accountant.</p>
            </div>
          </Card>
        </>
      ) : null}

      {/* Create statement modal */}
      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Create new tax statement" size="sm"
        footer={<div className="flex w-full justify-end gap-2"><Button variant="secondary" onClick={() => setCreateOpen(false)}>Cancel</Button></div>}>
        {uncreated.length === 0 ? (
          <p className="text-sm text-slate-500">You already have a statement for every available tax year.</p>
        ) : (
          <div className="space-y-2">
            <p className="text-sm text-slate-600">Generate a statement for a tax year:</p>
            {uncreated.map((y) => (
              <button key={y} onClick={() => create(y)} className="flex w-full items-center justify-between rounded-lg border border-slate-200 px-4 py-2.5 text-left text-sm font-medium text-slate-800 hover:border-brand-400 hover:bg-brand-50">
                <span>Tax year {y}</span><span className="text-brand-600">Create →</span>
              </button>
            ))}
          </div>
        )}
      </Modal>
    </>
  );
}

function Line({ label, value, strong, muted }: { label: string; value: string; strong?: boolean; muted?: boolean }) {
  return (
    <div className={`flex items-center justify-between py-1 ${strong ? "border-t border-slate-100 pt-2 font-semibold text-slate-900" : muted ? "text-slate-400" : "text-slate-600"}`}>
      <span>{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  );
}

function OwnerChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return <button onClick={onClick} className={`rounded-pill px-3.5 py-1.5 text-sm font-medium ring-1 ring-inset transition ${active ? "bg-brand-600 text-white ring-brand-600" : "bg-white text-slate-700 ring-slate-300 hover:bg-slate-50"}`}>{children}</button>;
}
