"use client";

import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Card, CardHeader, CardBody, Button, Select } from "@/components/ds";
import { ComplianceStatusChip } from "@/components/essentials/ComplianceStatusChip";
import { saveDepositAction } from "@/app/(app)/properties/[id]/deposit/actions";
import type { DepositView } from "@/server/compliance/records";
import type { EvaluatedObligation } from "@obligations-engine";

function Mono({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <span className={`font-mono ${className}`}>{children}</span>;
}

export function DepositWorkspace({
  propertyId,
  deposit,
  obligations,
}: {
  propertyId: string;
  deposit: DepositView | null;
  obligations: EvaluatedObligation[];
}) {
  const router = useRouter();
  const [scheme, setScheme] = useState(deposit?.scheme ?? "");
  const [depositGBP, setDepositGBP] = useState<number | null>(deposit?.depositGBP ?? null);
  const [receivedOn, setReceivedOn] = useState(deposit?.receivedOn ?? "");
  const [protectedOn, setProtectedOn] = useState(deposit?.protectedOn ?? "");
  const [prescribedInfoServedOn, setPrescribedInfoServedOn] = useState(deposit?.prescribedInfoServedOn ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Possession-blocking breaches: a possession-blocking obligation that is overdue.
  const blocking = obligations.filter((o) => o.blocksPossession && o.status === "overdue");

  async function save() {
    setError(null);
    setSaving(true);
    try {
      const result = await saveDepositAction({
        propertyId,
        scheme: scheme || null,
        depositGBP,
        receivedOn: receivedOn || null,
        protectedOn: protectedOn || null,
        prescribedInfoServedOn: prescribedInfoServedOn || null,
      });
      if (!result.ok) setError(result.error);
      else router.refresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* PROMINENT possession-blocking warning — red is a compliance-status signal. */}
      {blocking.length > 0 ? (
        <div className="rounded-card border-2 border-danger-300 bg-danger-50 p-4">
          <p className="text-sm font-bold uppercase tracking-wide text-danger-800">⚠ Blocks a possession claim</p>
          <ul className="mt-1 space-y-0.5 text-sm text-danger-800">
            {blocking.map((o) => (
              <li key={o.ruleId}>
                {o.title} is non-compliant. <span className="text-danger-700">{o.basis.summary}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Deposit record */}
        <Card>
          <CardHeader title="Deposit record" subtitle="Scheme, protection and prescribed information." />
          <CardBody>
            <div className="space-y-4">
              <Field label="Authorised scheme">
                <Select
                  className="w-full"
                  value={scheme}
                  onChange={(e) => setScheme(e.target.value)}
                  options={[
                    { value: "", label: "— none —" },
                    { value: "tds", label: "TDS" },
                    { value: "dps", label: "DPS" },
                    { value: "mydeposits", label: "mydeposits" },
                  ]}
                />
              </Field>
              <Field label="Deposit amount (£)">
                <input
                  type="number"
                  min={0}
                  className="input font-mono"
                  value={depositGBP ?? ""}
                  onChange={(e) => setDepositGBP(e.target.value === "" ? null : Number(e.target.value))}
                />
              </Field>
              <Field label="Date deposit received">
                <input type="date" className="input font-mono" value={receivedOn} onChange={(e) => setReceivedOn(e.target.value)} />
              </Field>
              <Field label="Date protected in scheme">
                <input type="date" className="input font-mono" value={protectedOn} onChange={(e) => setProtectedOn(e.target.value)} />
              </Field>
              <Field label="Date prescribed information served">
                <input type="date" className="input font-mono" value={prescribedInfoServedOn} onChange={(e) => setPrescribedInfoServedOn(e.target.value)} />
              </Field>

              <div className="flex items-center gap-3 pt-1">
                <Button onClick={save} disabled={saving}>
                  {saving ? "Saving…" : "Save & recompute"}
                </Button>
                {error ? <span className="text-sm text-red-700">{error}</span> : null}
              </div>
            </div>
          </CardBody>
        </Card>

        {/* Obligations — statuses from the engine */}
        <Card>
          <CardHeader title="Obligations" subtitle="Statuses and deadlines are read from the engine." />
          <CardBody>
            <ul className="divide-y divide-slate-100">
              {obligations.map((o) => (
                <li key={o.ruleId} className="py-3">
                  <div className="flex items-start justify-between gap-3">
                    <span className="text-sm font-semibold text-slate-800">{o.title}</span>
                    <ComplianceStatusChip status={o.status} />
                  </div>
                  <p className="mt-0.5 text-sm text-slate-500">{o.basis.summary}</p>
                  {o.dueDate ? (
                    <p className="mt-0.5 text-sm text-slate-600">
                      Deadline: <Mono>{o.dueDate}</Mono>
                    </p>
                  ) : null}
                  <p className="mt-1 font-mono text-[11px] text-slate-400">{o.citation}</p>
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-slate-700">{label}</span>
      {children}
    </label>
  );
}
