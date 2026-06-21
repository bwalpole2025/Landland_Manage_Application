"use client";

import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Card, CardHeader, CardBody, Button } from "@/components/ds";
import { ComplianceStatusChip } from "@/components/essentials/ComplianceStatusChip";
import {
  uploadCertificateAction,
  confirmExpiryAction,
  confirmGasInspectionAction,
  removeCertificateAction,
} from "@/app/(app)/properties/[id]/safety/actions";
import type { EvidenceView } from "@/server/documents/service";
import type { EvidenceKind } from "@prisma/client";
import type { ObligationStatus } from "@obligations-engine";

export interface SafetyItem {
  ruleId: string;
  kind: EvidenceKind;
  title: string;
  citation: string;
  status: ObligationStatus;
  /** Read DIRECTLY from the engine — never computed here. */
  dueDate: string | null;
  /** Plain-language WHY from the engine basis. */
  why: string;
  evidence: EvidenceView[];
}

function Mono({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <span className={`font-mono ${className}`}>{children}</span>;
}

export function SafetyWorkspace({ propertyId, items }: { propertyId: string; items: SafetyItem[] }) {
  return (
    <div className="space-y-6">
      {items.map((item) => (
        <ObligationCard key={item.ruleId} propertyId={propertyId} item={item} />
      ))}
    </div>
  );
}

function ObligationCard({ propertyId, item }: { propertyId: string; item: SafetyItem }) {
  const router = useRouter();
  const isGas = item.kind === "GAS_SAFETY";
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onUpload(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setUploading(true);
    try {
      const fd = new FormData(e.currentTarget);
      fd.set("propertyId", propertyId);
      fd.set("kind", item.kind);
      const result = await uploadCertificateAction(fd);
      if (!result.ok) setError(result.error);
      else {
        (e.target as HTMLFormElement).reset();
        router.refresh();
      }
    } finally {
      setUploading(false);
    }
  }

  return (
    <Card>
      <CardHeader
        title={
          <span className="flex items-center gap-2">
            {item.title}
            <ComplianceStatusChip status={item.status} />
          </span>
        }
        subtitle={<Mono className="text-[11px] text-slate-400">{item.citation}</Mono>}
      />
      <CardBody>
        {/* Next-due + WHY — both straight from the engine */}
        <div className="rounded-lg bg-slate-50 px-3 py-2">
          <p className="text-sm text-slate-700">
            Next due:{" "}
            {item.dueDate ? <Mono className="font-semibold">{item.dueDate}</Mono> : <span className="text-slate-400">— (no confirmed certificate)</span>}
          </p>
          {item.why ? <p className="mt-1 text-sm text-slate-500">{item.why}</p> : null}
        </div>

        {/* Evidence on file */}
        {item.evidence.length > 0 ? (
          <ul className="mt-3 divide-y divide-slate-100">
            {item.evidence.map((ev) => (
              <EvidenceRow key={ev.id} propertyId={propertyId} isGas={isGas} ev={ev} />
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-sm text-slate-500">No certificate uploaded yet.</p>
        )}

        {/* Upload */}
        <form onSubmit={onUpload} className="mt-4 flex flex-wrap items-center gap-3 border-t border-slate-100 pt-4">
          <input
            name="file"
            type="file"
            required
            className="block text-sm text-slate-600 file:mr-3 file:rounded-pill file:border-0 file:bg-brand-50 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-brand-700 hover:file:bg-brand-100"
          />
          <Button type="submit" disabled={uploading}>
            {uploading ? "Uploading…" : "Upload certificate"}
          </Button>
          {error ? <span className="text-sm text-red-700">{error}</span> : null}
        </form>
      </CardBody>
    </Card>
  );
}

function EvidenceRow({ propertyId, isGas, ev }: { propertyId: string; isGas: boolean; ev: EvidenceView }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Gas captures BOTH the inspection date and the original anniversary.
  const [inspectionDate, setInspectionDate] = useState(ev.issuedOn ?? "");
  const [anniversary, setAnniversary] = useState(ev.anniversary ?? "");
  const [expiry, setExpiry] = useState(ev.expiresOn ?? ev.proposedExpiresOn ?? "");

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
    <li className="py-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <a href={ev.signedUrl} target="_blank" rel="noreferrer" className="text-sm font-medium text-brand-600 hover:underline">
            {ev.filename}
          </a>
          <p className="mt-0.5">
            <Mono className="text-[11px] text-slate-400">{ev.storageKey}</Mono>
          </p>
        </div>
        <button onClick={() => run(() => removeCertificateAction({ propertyId, evidenceId: ev.id }))} disabled={busy} className="shrink-0 text-xs text-slate-400 hover:text-slate-600">
          Remove
        </button>
      </div>

      <div className="mt-2 rounded-lg bg-slate-50 px-3 py-2">
        {isGas ? (
          ev.confirmed ? (
            <p className="text-sm text-slate-700">
              Confirmed — inspection <Mono className="font-semibold">{ev.issuedOn}</Mono>, original anniversary{" "}
              <Mono className="font-semibold">{ev.anniversary}</Mono>. The engine derives the next-due date from these.
            </p>
          ) : (
            <div>
              <p className="text-sm text-slate-600">
                Confirm the gas inspection: enter the <strong>inspection date</strong> and the{" "}
                <strong>original anniversary</strong>. The engine applies anniversary preservation.
              </p>
              <div className="mt-2 flex flex-wrap items-end gap-2">
                <label className="text-xs text-slate-500">
                  Inspection date
                  <input type="date" className="input font-mono mt-1 block max-w-[12rem]" value={inspectionDate} onChange={(e) => setInspectionDate(e.target.value)} />
                </label>
                <label className="text-xs text-slate-500">
                  Original anniversary
                  <input type="date" className="input font-mono mt-1 block max-w-[12rem]" value={anniversary} onChange={(e) => setAnniversary(e.target.value)} />
                </label>
                <Button
                  variant="secondary"
                  disabled={busy || !inspectionDate || !anniversary}
                  onClick={() => run(() => confirmGasInspectionAction({ propertyId, evidenceId: ev.id, inspectionDate, anniversary }))}
                >
                  {busy ? "…" : "Confirm gas inspection"}
                </Button>
              </div>
            </div>
          )
        ) : ev.confirmed ? (
          <p className="text-sm text-slate-700">
            Confirmed expiry: <Mono className="font-semibold">{ev.expiresOn}</Mono> — the engine reads this.
          </p>
        ) : (
          <div>
            <p className="text-sm text-slate-600">
              The expiry on the certificate is a proposal until you confirm it.
            </p>
            <div className="mt-2 flex items-center gap-2">
              <input type="date" className="input font-mono max-w-[12rem]" value={expiry} onChange={(e) => setExpiry(e.target.value)} />
              <Button variant="secondary" disabled={busy || !expiry} onClick={() => run(() => confirmExpiryAction({ propertyId, evidenceId: ev.id, expiresOn: expiry }))}>
                {busy ? "…" : "Confirm expiry"}
              </Button>
            </div>
          </div>
        )}
        {error ? <p className="mt-1 text-xs text-red-700">{error}</p> : null}
      </div>
    </li>
  );
}
