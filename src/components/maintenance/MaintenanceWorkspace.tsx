"use client";

import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Card, CardHeader, CardBody, Button, Select, Badge } from "@/components/ds";
import { addMaintenanceAction, markMaintenanceAction, removeMaintenanceAction } from "@/app/(app)/properties/[id]/maintenance/actions";
import type { MaintenanceView } from "@/server/compliance/maintenance";

const CATEGORIES = ["Damp & mould", "Heating", "Electrical", "Plumbing", "Structural", "Pest", "Other"];

function Mono({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <span className={`font-mono ${className}`}>{children}</span>;
}
function ts(iso: string | null): string {
  return iso ? iso.slice(0, 16).replace("T", " ") : "—";
}
function statusLabel(l: MaintenanceView): string {
  if (l.resolvedAt) return "Resolved";
  if (l.respondedAt) return "In progress";
  return "Open";
}

export function MaintenanceWorkspace({ propertyId, logs }: { propertyId: string; logs: MaintenanceView[] }) {
  const router = useRouter();
  const [category, setCategory] = useState("Damp & mould");
  const [description, setDescription] = useState("");
  const [hazard, setHazard] = useState(false);
  const [reportedAt, setReportedAt] = useState("");
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
    <Card>
      <CardHeader title="Repairs log" subtitle="Each request and response is timestamped." />
      <CardBody>
        <div className="space-y-3 border-b border-slate-100 pb-4">
          <div className="flex flex-wrap items-end gap-2">
            <label className="text-xs text-slate-500">Category<Select className="mt-1 block" value={category} onChange={(e) => setCategory(e.target.value)} options={CATEGORIES.map((c) => ({ value: c, label: c }))} /></label>
            <label className="text-xs text-slate-500">Reported (date)<input type="date" className="input font-mono mt-1 block max-w-[10rem]" value={reportedAt} onChange={(e) => setReportedAt(e.target.value)} /></label>
            <label className="flex items-center gap-2 pb-2 text-sm text-slate-700"><input type="checkbox" className="h-4 w-4" checked={hazard} onChange={(e) => setHazard(e.target.checked)} /> Hazard (Awaab&apos;s Law)</label>
          </div>
          <div className="flex items-end gap-2">
            <label className="flex-1 text-xs text-slate-500">Description<input className="input mt-1 block w-full" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="e.g. Damp and mould in the bathroom" /></label>
            <Button onClick={() => run(() => addMaintenanceAction({ propertyId, category, description, hazard, reportedAt: reportedAt || null }).then((r) => { if (r.ok) { setDescription(""); setHazard(false); setReportedAt(""); } return r; }))} disabled={busy}>
              Log repair
            </Button>
          </div>
          {error ? <span className="text-sm text-red-700">{error}</span> : null}
        </div>

        {logs.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">No repairs logged.</p>
        ) : (
          <ul className="mt-3 divide-y divide-slate-100">
            {logs.map((l) => (
              <li key={l.id} className="py-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold text-slate-800">{l.description}</span>
                      <Badge tone="neutral">{l.category}</Badge>
                      {l.hazard ? <Badge tone="neutral">hazard</Badge> : null}
                      <Badge tone="neutral">{statusLabel(l)}</Badge>
                    </div>
                    <p className="mt-0.5 text-xs text-slate-500">
                      reported <Mono>{ts(l.reportedAt)}</Mono>
                      {l.respondedAt ? <> · responded <Mono>{ts(l.respondedAt)}</Mono>{l.responseHours !== null ? <> (<Mono>{l.responseHours}h</Mono>)</> : null}</> : null}
                      {l.resolvedAt ? <> · resolved <Mono>{ts(l.resolvedAt)}</Mono></> : null}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {!l.respondedAt ? <button onClick={() => run(() => markMaintenanceAction({ propertyId, logId: l.id, respond: true }))} disabled={busy} className="text-xs font-medium text-brand-600 hover:underline">Record response</button> : null}
                    {!l.resolvedAt ? <button onClick={() => run(() => markMaintenanceAction({ propertyId, logId: l.id, resolve: true }))} disabled={busy} className="text-xs font-medium text-brand-600 hover:underline">Resolve</button> : null}
                    <button onClick={() => run(() => removeMaintenanceAction({ propertyId, logId: l.id }))} disabled={busy} className="text-xs text-slate-400 hover:text-slate-600">Remove</button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardBody>
    </Card>
  );
}
