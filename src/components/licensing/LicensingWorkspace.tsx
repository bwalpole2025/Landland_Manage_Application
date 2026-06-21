"use client";

import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Card, CardHeader, CardBody, Button, Select, Badge } from "@/components/ds";
import { ComplianceStatusChip } from "@/components/essentials/ComplianceStatusChip";
import { addLicenceAction, removeLicenceAction } from "@/app/(app)/properties/[id]/licensing/actions";
import type { LicenceView } from "@/server/compliance/licensing";
import type { EvaluatedObligation } from "@obligations-engine";

const TYPE_LABELS: Record<string, string> = { HMO: "HMO", ADDITIONAL: "Additional", SELECTIVE: "Selective" };

function Mono({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <span className={`font-mono ${className}`}>{children}</span>;
}

export function LicensingWorkspace({
  propertyId,
  licences,
  obligations,
}: {
  propertyId: string;
  licences: LicenceView[];
  obligations: EvaluatedObligation[];
}) {
  const router = useRouter();
  const [type, setType] = useState("HMO");
  const [reference, setReference] = useState("");
  const [grantedOn, setGrantedOn] = useState("");
  const [expiresOn, setExpiresOn] = useState("");
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
        <CardHeader title="Licences" subtitle="Grant and expiry dates. Mapped to the engine's licence-expiry obligations." />
        <CardBody>
          <div className="flex flex-wrap items-end gap-2 border-b border-slate-100 pb-4">
            <label className="text-xs text-slate-500">Type<Select className="mt-1 block" value={type} onChange={(e) => setType(e.target.value)} options={[{ value: "HMO", label: "HMO" }, { value: "ADDITIONAL", label: "Additional" }, { value: "SELECTIVE", label: "Selective" }]} /></label>
            <label className="text-xs text-slate-500">Reference<input className="input mt-1 block max-w-[10rem]" value={reference} onChange={(e) => setReference(e.target.value)} /></label>
            <label className="text-xs text-slate-500">Granted<input type="date" className="input font-mono mt-1 block max-w-[10rem]" value={grantedOn} onChange={(e) => setGrantedOn(e.target.value)} /></label>
            <label className="text-xs text-slate-500">Expires<input type="date" className="input font-mono mt-1 block max-w-[10rem]" value={expiresOn} onChange={(e) => setExpiresOn(e.target.value)} /></label>
            <Button onClick={() => run(() => addLicenceAction({ propertyId, type, reference: reference || null, grantedOn: grantedOn || null, expiresOn: expiresOn || null }).then((r) => { if (r.ok) { setReference(""); setGrantedOn(""); setExpiresOn(""); } return r; }))} disabled={busy}>
              Add licence
            </Button>
            {error ? <span className="text-sm text-red-700">{error}</span> : null}
          </div>

          {licences.length === 0 ? (
            <p className="mt-3 text-sm text-slate-500">No licences recorded.</p>
          ) : (
            <ul className="mt-3 divide-y divide-slate-100">
              {licences.map((l) => (
                <li key={l.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                  <span className="flex flex-wrap items-center gap-2">
                    <Badge tone="neutral">{TYPE_LABELS[l.type] ?? l.type}</Badge>
                    {l.reference ? <Mono className="text-slate-500">{l.reference}</Mono> : null}
                    <span className="text-slate-400">granted</span> <Mono>{l.grantedOn ?? "—"}</Mono>
                    <span className="text-slate-400">expires</span> <Mono className="font-semibold">{l.expiresOn ?? "—"}</Mono>
                  </span>
                  <button onClick={() => run(() => removeLicenceAction({ propertyId, licenceId: l.id }))} disabled={busy} className="text-xs text-slate-400 hover:text-slate-600">Remove</button>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Obligations" subtitle="Statuses read from the engine." />
        <CardBody>
          <ul className="divide-y divide-slate-100">
            {obligations.map((o) => (
              <li key={o.ruleId} className="py-3">
                <div className="flex items-start justify-between gap-3">
                  <span className="text-sm font-semibold text-slate-800">{o.title}</span>
                  <ComplianceStatusChip status={o.status} />
                </div>
                <p className="mt-0.5 text-sm text-slate-500">{o.basis.summary}</p>
                {o.dueDate ? <p className="mt-0.5 text-sm text-slate-600">Expires: <Mono>{o.dueDate}</Mono></p> : null}
                <p className="mt-1 font-mono text-[11px] text-slate-400">{o.citation}</p>
              </li>
            ))}
          </ul>
        </CardBody>
      </Card>
    </div>
  );
}
