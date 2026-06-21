"use client";

import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Card, CardHeader, CardBody, Button, Select, Badge } from "@/components/ds";
import { ComplianceStatusChip } from "@/components/essentials/ComplianceStatusChip";
import { addTenantAction, removeTenantAction } from "@/app/(app)/properties/[id]/tenants/actions";
import type { TenantView } from "@/server/compliance/tenants";
import type { EvaluatedObligation } from "@obligations-engine";

const RTR_LABELS: Record<string, string> = { UNLIMITED: "Unlimited", TIME_LIMITED: "Time-limited", NOT_CHECKED: "Not checked" };

function Mono({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <span className={`font-mono ${className}`}>{children}</span>;
}

export function TenantsWorkspace({
  propertyId,
  tenants,
  rightToRent,
}: {
  propertyId: string;
  tenants: TenantView[];
  rightToRent: EvaluatedObligation | null;
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState("NOT_CHECKED");
  const [checkedOn, setCheckedOn] = useState("");
  const [recheckDue, setRecheckDue] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(fn: () => Promise<{ ok: true } | { ok: false; error: string }>) {
    setError(null);
    setBusy(true);
    try {
      const r = await fn();
      if (!r.ok) setError(r.error);
      else router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader title="Tenants & Right to Rent" subtitle="Record each tenant's Right to Rent check and any re-check date." />
        <CardBody>
          <div className="space-y-3 border-b border-slate-100 pb-4">
            <div className="flex flex-wrap items-end gap-2">
              <label className="text-xs text-slate-500">Name<input className="input mt-1 block max-w-[12rem]" value={name} onChange={(e) => setName(e.target.value)} /></label>
              <label className="text-xs text-slate-500">Email<input className="input mt-1 block max-w-[12rem]" value={email} onChange={(e) => setEmail(e.target.value)} /></label>
            </div>
            <div className="flex flex-wrap items-end gap-2">
              <label className="text-xs text-slate-500">Right to Rent<Select className="mt-1 block" value={status} onChange={(e) => setStatus(e.target.value)} options={[{ value: "NOT_CHECKED", label: "Not checked" }, { value: "UNLIMITED", label: "Unlimited" }, { value: "TIME_LIMITED", label: "Time-limited" }]} /></label>
              <label className="text-xs text-slate-500">Checked on<input type="date" className="input font-mono mt-1 block max-w-[10rem]" value={checkedOn} onChange={(e) => setCheckedOn(e.target.value)} /></label>
              <label className="text-xs text-slate-500">Re-check due<input type="date" className="input font-mono mt-1 block max-w-[10rem]" value={recheckDue} onChange={(e) => setRecheckDue(e.target.value)} /></label>
              <Button onClick={() => run(() => addTenantAction({ propertyId, name, email: email || null, rightToRentStatus: status, rightToRentCheckedOn: checkedOn || null, rightToRentRecheckDue: recheckDue || null }).then((r) => { if (r.ok) { setName(""); setEmail(""); setCheckedOn(""); setRecheckDue(""); setStatus("NOT_CHECKED"); } return r; }))} disabled={busy}>
                Add tenant
              </Button>
            </div>
            {error ? <span className="text-sm text-red-700">{error}</span> : null}
          </div>

          {tenants.length === 0 ? (
            <p className="mt-3 text-sm text-slate-500">No tenants recorded.</p>
          ) : (
            <ul className="mt-3 divide-y divide-slate-100">
              {tenants.map((t) => (
                <li key={t.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-slate-800">{t.name}</span>
                    <Badge tone="neutral">{RTR_LABELS[t.rightToRentStatus] ?? t.rightToRentStatus}</Badge>
                    {t.rightToRentCheckedOn ? <><span className="text-slate-400">checked</span> <Mono>{t.rightToRentCheckedOn}</Mono></> : null}
                    {t.rightToRentRecheckDue ? <><span className="text-slate-400">re-check</span> <Mono className="font-semibold">{t.rightToRentRecheckDue}</Mono></> : null}
                  </span>
                  <button onClick={() => run(() => removeTenantAction({ propertyId, tenantId: t.id }))} disabled={busy} className="text-xs text-slate-400 hover:text-slate-600">Remove</button>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Right to Rent obligation" subtitle="Status read from the engine." />
        <CardBody>
          {!rightToRent ? (
            <p className="text-sm text-slate-500">No Right to Rent obligation.</p>
          ) : (
            <div>
              <div className="flex items-center gap-2">
                <ComplianceStatusChip status={rightToRent.status} />
                <span className="text-sm font-semibold text-slate-800">{rightToRent.title}</span>
              </div>
              <p className="mt-1 text-sm text-slate-500">{rightToRent.basis.summary}</p>
              {rightToRent.dueDate ? <p className="mt-0.5 text-sm text-slate-600">Next re-check: <Mono>{rightToRent.dueDate}</Mono></p> : null}
              <p className="mt-1 font-mono text-[11px] text-slate-400">{rightToRent.citation}</p>
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
