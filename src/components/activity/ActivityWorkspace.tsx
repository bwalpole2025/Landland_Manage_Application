"use client";

import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Card, CardHeader, CardBody, Button, Badge } from "@/components/ds";
import { recordCorrectionAction } from "@/app/(app)/properties/[id]/activity/actions";
import type { ActivityView } from "@/server/compliance/activity";

function Mono({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <span className={`font-mono ${className}`}>{children}</span>;
}
function ts(iso: string): string {
  return iso.slice(0, 16).replace("T", " ");
}

export function ActivityWorkspace({ propertyId, entries }: { propertyId: string; entries: ActivityView[] }) {
  const router = useRouter();
  const [summary, setSummary] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function record() {
    setError(null);
    setBusy(true);
    try {
      const r = await recordCorrectionAction({ propertyId, summary, correctsId: null });
      if (!r.ok) setError(r.error);
      else {
        setSummary("");
        router.refresh();
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader title="Record a correction" subtitle="Corrections are appended as a new row — nothing is ever edited or deleted." />
        <CardBody>
          <div className="flex items-end gap-2">
            <label className="flex-1 text-xs text-slate-500">Correction note<input className="input mt-1 block w-full" value={summary} onChange={(e) => setSummary(e.target.value)} placeholder="e.g. The gas inspection date above was mistyped; correct date is 2026-03-10." /></label>
            <Button onClick={record} disabled={busy || !summary.trim()}>{busy ? "…" : "Append correction"}</Button>
          </div>
          {error ? <p className="mt-1 text-sm text-red-700">{error}</p> : null}
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Activity trail" subtitle="Append-only — newest first." />
        <CardBody>
          {entries.length === 0 ? (
            <p className="text-sm text-slate-500">No activity recorded yet.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {entries.map((e) => (
                <li key={e.id} className="flex items-start justify-between gap-3 py-2.5 text-sm">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone="neutral">{e.action}</Badge>
                      <span className="text-slate-400">{e.entity}</span>
                      {e.isCorrection ? <Badge tone="neutral">correction</Badge> : null}
                      <span className="text-slate-700">{e.summary}</span>
                    </div>
                    {e.actorName ? <p className="mt-0.5 text-xs text-slate-400">by {e.actorName}</p> : null}
                  </div>
                  <time className="shrink-0"><Mono className="text-[11px] text-slate-400">{ts(e.createdAt)}</Mono></time>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
