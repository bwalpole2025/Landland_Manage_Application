"use client";

import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Card, CardHeader, CardBody, Button, Select, Badge } from "@/components/ds";
import { ComplianceStatusChip } from "@/components/essentials/ComplianceStatusChip";
import { saveCurrentTenancyAction, startNewTenancyAction } from "@/app/(app)/properties/[id]/tenancy/actions";
import type { TenancyView } from "@/server/compliance/records";
import type { EvaluatedObligation } from "@obligations-engine";

const KIND_OPTIONS = [
  { value: "PERIODIC_ASSURED", label: "Periodic assured (RRA default)" },
  { value: "FIXED_TERM", label: "Fixed term" },
  { value: "OTHER", label: "Other" },
];
const KIND_LABELS: Record<string, string> = Object.fromEntries(KIND_OPTIONS.map((o) => [o.value, o.label]));

function Mono({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <span className={`font-mono ${className}`}>{children}</span>;
}

export function TenancyWorkspace({
  propertyId,
  tenancies,
  obligations,
}: {
  propertyId: string;
  tenancies: TenancyView[];
  obligations: EvaluatedObligation[];
}) {
  const router = useRouter();
  const current = tenancies.find((t) => t.isCurrent) ?? null;
  const history = tenancies.filter((t) => !t.isCurrent);

  const [kind, setKind] = useState(current?.kind ?? "PERIODIC_ASSURED");
  const [startDate, setStartDate] = useState(current?.startDate ?? "");
  const [writtenTermsProvidedOn, setWrittenTermsProvidedOn] = useState(current?.writtenTermsProvidedOn ?? "");
  const [informationProvidedOn, setInformationProvidedOn] = useState(current?.informationProvidedOn ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function fields() {
    return { propertyId, kind, startDate: startDate || null, writtenTermsProvidedOn: writtenTermsProvidedOn || null, informationProvidedOn: informationProvidedOn || null };
  }

  async function run(fn: () => Promise<{ ok: true } | { ok: false; error: string }>) {
    setError(null);
    setBusy(true);
    try {
      const result = await fn();
      if (!result.ok) setError(result.error);
      else router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      {/* Current tenancy */}
      <Card>
        <CardHeader title="Current tenancy" subtitle="The Renters' Rights Act makes tenancies periodic assured by default." />
        <CardBody>
          <div className="space-y-4">
            <Field label="Tenancy type">
              <Select className="w-full" value={kind} onChange={(e) => setKind(e.target.value)} options={KIND_OPTIONS} />
            </Field>
            <Field label="Start date">
              <input type="date" className="input font-mono" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </Field>
            <Field label="Written statement of terms provided on">
              <input type="date" className="input font-mono" value={writtenTermsProvidedOn} onChange={(e) => setWrittenTermsProvidedOn(e.target.value)} />
            </Field>
            <Field label="Tenant information provided on">
              <input type="date" className="input font-mono" value={informationProvidedOn} onChange={(e) => setInformationProvidedOn(e.target.value)} />
            </Field>

            <div className="flex flex-wrap items-center gap-3 pt-1">
              <Button onClick={() => run(() => saveCurrentTenancyAction(fields()))} disabled={busy}>
                {busy ? "Saving…" : "Save current tenancy"}
              </Button>
              <Button variant="secondary" onClick={() => run(() => startNewTenancyAction(fields()))} disabled={busy || !startDate}>
                Start a new tenancy
              </Button>
              {error ? <span className="text-sm text-red-700">{error}</span> : null}
            </div>
            <p className="text-xs text-slate-400">&ldquo;Start a new tenancy&rdquo; archives the current one into history.</p>
          </div>

          {/* History */}
          {history.length > 0 ? (
            <div className="mt-5 border-t border-slate-100 pt-4">
              <p className="mb-2 text-sm font-semibold text-slate-800">Tenancy history</p>
              <ul className="space-y-1.5 text-sm">
                {history.map((t) => (
                  <li key={t.id} className="flex items-center justify-between gap-3">
                    <span className="text-slate-600">{KIND_LABELS[t.kind] ?? t.kind}</span>
                    <Mono className="text-slate-500">
                      {t.startDate ?? "—"} → {t.endDate ?? "—"}
                    </Mono>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </CardBody>
      </Card>

      {/* Obligations — statuses from the engine */}
      <Card>
        <CardHeader title="Obligations" subtitle="Statuses and deadlines are read from the engine." />
        <CardBody>
          <div className="mb-3">
            <Badge tone="neutral">{KIND_LABELS[current?.kind ?? "PERIODIC_ASSURED"]}</Badge>
          </div>
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
