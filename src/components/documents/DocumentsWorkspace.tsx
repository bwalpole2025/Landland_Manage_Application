"use client";

import { useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Card, CardHeader, CardBody, Button, Select, Badge } from "@/components/ds";
import { uploadEvidenceAction, confirmExpiryAction, removeEvidenceAction } from "@/app/(app)/properties/[id]/documents/actions";

export interface EvidenceItem {
  id: string;
  kind: string;
  filename: string;
  storageKey: string;
  contentType: string | null;
  signedUrl: string;
  issuedOn: string | null;
  proposedExpiresOn: string | null;
  expiresOn: string | null;
  confirmed: boolean;
  createdAt: string;
}

const KIND_LABELS: Record<string, string> = {
  GAS_SAFETY: "Gas safety (CP12)",
  EICR: "EICR",
  EPC: "EPC",
  INSURANCE: "Insurance",
  DEPOSIT_PROTECTION: "Deposit protection",
  HMO_LICENCE: "HMO licence",
  SELECTIVE_LICENCE: "Selective licence",
  OTHER: "Other",
};

function Mono({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <span className={`font-mono ${className}`}>{children}</span>;
}

export function DocumentsWorkspace({ propertyId, initialEvidence }: { propertyId: string; initialEvidence: EvidenceItem[] }) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onUpload(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setUploading(true);
    try {
      const fd = new FormData(e.currentTarget);
      fd.set("propertyId", propertyId);
      const result = await uploadEvidenceAction(fd);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      formRef.current?.reset();
      router.refresh();
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      {/* Upload */}
      <Card>
        <CardHeader title="Upload a document" subtitle="Stored via StoragePort under your owner-namespaced key." />
        <CardBody>
          <form ref={formRef} onSubmit={onUpload} className="space-y-4">
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-700">Document type</span>
              <Select
                className="w-full"
                name="kind"
                defaultValue="GAS_SAFETY"
                options={Object.entries(KIND_LABELS).map(([value, label]) => ({ value, label }))}
              />
            </label>

            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-700">File</span>
              <input name="file" type="file" required className="block w-full text-sm text-slate-600 file:mr-3 file:rounded-pill file:border-0 file:bg-brand-50 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-brand-700 hover:file:bg-brand-100" />
            </label>

            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-700">
                Expiry on the certificate <span className="font-normal text-slate-400">(a proposal — you confirm it below)</span>
              </span>
              <input name="proposedExpiresOn" type="date" className="input font-mono" />
            </label>

            {error ? <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}

            <Button type="submit" disabled={uploading}>
              {uploading ? "Uploading…" : "Upload document"}
            </Button>
          </form>
        </CardBody>
      </Card>

      {/* Evidence list */}
      <Card>
        <CardHeader title="Evidence on file" subtitle="A confirmed expiry is the structural fact the engine reads." />
        <CardBody>
          {initialEvidence.length === 0 ? (
            <p className="text-sm text-slate-500">No documents uploaded yet.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {initialEvidence.map((item) => (
                <EvidenceRow key={item.id} propertyId={propertyId} item={item} />
              ))}
            </ul>
          )}
        </CardBody>
      </Card>
    </div>
  );
}

function EvidenceRow({ propertyId, item }: { propertyId: string; item: EvidenceItem }) {
  const router = useRouter();
  const [expiry, setExpiry] = useState(item.proposedExpiresOn ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function confirm() {
    setError(null);
    setBusy(true);
    try {
      const result = await confirmExpiryAction({ propertyId, evidenceId: item.id, expiresOn: expiry });
      if (!result.ok) setError(result.error);
      else router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    setBusy(true);
    try {
      await removeEvidenceAction({ propertyId, evidenceId: item.id });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <li className="py-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-slate-800">{KIND_LABELS[item.kind] ?? item.kind}</span>
            {/* Neutral/brand only — red/amber/green are reserved for compliance status. */}
            {item.confirmed ? <Badge tone="brand">Confirmed</Badge> : <Badge tone="neutral">Proposed</Badge>}
          </div>
          <a href={item.signedUrl} target="_blank" rel="noreferrer" className="text-sm font-medium text-brand-600 hover:underline">
            {item.filename}
          </a>
          <p className="mt-0.5">
            <Mono className="text-[11px] text-slate-400">{item.storageKey}</Mono>
          </p>
        </div>
        <button onClick={remove} disabled={busy} className="shrink-0 text-xs text-slate-400 hover:text-slate-600">
          Remove
        </button>
      </div>

      {/* Expiry — proposal vs authoritative */}
      <div className="mt-2 rounded-lg bg-slate-50 px-3 py-2">
        {item.confirmed ? (
          <p className="text-sm text-slate-700">
            Authoritative expiry: <Mono className="font-semibold">{item.expiresOn}</Mono>{" "}
            <span className="text-slate-400">— the engine reads this.</span>
          </p>
        ) : (
          <div>
            <p className="text-sm text-slate-600">
              Proposed expiry{" "}
              {item.proposedExpiresOn ? <Mono>{item.proposedExpiresOn}</Mono> : <span className="text-slate-400">(none extracted)</span>} — not
              yet authoritative. Confirm it to make it the date the engine uses.
            </p>
            <div className="mt-2 flex items-center gap-2">
              <input type="date" className="input font-mono max-w-[12rem]" value={expiry} onChange={(e) => setExpiry(e.target.value)} />
              <Button variant="secondary" onClick={confirm} disabled={busy || !expiry}>
                {busy ? "…" : "Confirm expiry"}
              </Button>
            </div>
            {error ? <p className="mt-1 text-xs text-red-700">{error}</p> : null}
          </div>
        )}
      </div>
    </li>
  );
}
