"use client";

import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Card, CardHeader, CardBody, Button, Select, Badge } from "@/components/ds";
import { ComplianceStatusChip } from "@/components/essentials/ComplianceStatusChip";
import {
  saveScheduleAction,
  addReceiptAction,
  removeReceiptAction,
  assessGround8Action,
} from "@/app/(app)/properties/[id]/rent/actions";
import type { ScheduleView, ReceiptView } from "@/server/compliance/rent";
import type { ArrearsAssessment } from "@obligations-engine";

function Mono({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <span className={`font-mono ${className}`}>{children}</span>;
}
function gbp(n: number): string {
  return `${n < 0 ? "-" : ""}£${Math.abs(n).toLocaleString("en-GB")}`;
}
/** Neutral pass/fail glyph — NOT red/amber/green (reserved for status). */
function Glyph({ met }: { met: boolean }) {
  return (
    <span aria-hidden className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[11px] font-bold text-slate-600">
      {met ? "✓" : "✕"}
    </span>
  );
}

export function RentWorkspace({
  propertyId,
  schedule,
  receipts,
  assessment,
}: {
  propertyId: string;
  schedule: ScheduleView | null;
  receipts: ReceiptView[];
  assessment: ArrearsAssessment | null;
}) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <ScheduleCard propertyId={propertyId} schedule={schedule} />
        <ArrearsCard assessment={assessment} />
      </div>
      <ReceiptsCard propertyId={propertyId} receipts={receipts} />
      {assessment ? <Ground8Card propertyId={propertyId} assessment={assessment} /> : null}
    </div>
  );
}

function ScheduleCard({ propertyId, schedule }: { propertyId: string; schedule: ScheduleView | null }) {
  const router = useRouter();
  const [frequency, setFrequency] = useState<string>(schedule?.frequency ?? "MONTHLY");
  const [rentGBP, setRentGBP] = useState<number | null>(schedule?.rentGBP ?? null);
  const [startDate, setStartDate] = useState(schedule?.startDate ?? "");
  const [endDate, setEndDate] = useState(schedule?.endDate ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setError(null);
    setBusy(true);
    try {
      const r = await saveScheduleAction({ propertyId, frequency, rentGBP, startDate: startDate || null, endDate: endDate || null });
      if (!r.ok) setError(r.error);
      else router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader title="Expected schedule" subtitle="The engine generates due dates from these." />
      <CardBody>
        <div className="space-y-4">
          <Field label="Frequency">
            <Select className="w-full" value={frequency} onChange={(e) => setFrequency(e.target.value)} options={[{ value: "MONTHLY", label: "Monthly" }, { value: "WEEKLY", label: "Weekly" }]} />
          </Field>
          <Field label="Rent amount (£)">
            <input type="number" min={0} className="input font-mono" value={rentGBP ?? ""} onChange={(e) => setRentGBP(e.target.value === "" ? null : Number(e.target.value))} />
          </Field>
          <Field label="Start date">
            <input type="date" className="input font-mono" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </Field>
          <Field label="End date (optional)">
            <input type="date" className="input font-mono" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </Field>
          <div className="flex items-center gap-3 pt-1">
            <Button onClick={save} disabled={busy}>{busy ? "Saving…" : "Save schedule"}</Button>
            {error ? <span className="text-sm text-red-700">{error}</span> : null}
          </div>
        </div>
      </CardBody>
    </Card>
  );
}

function ArrearsCard({ assessment }: { assessment: ArrearsAssessment | null }) {
  return (
    <Card>
      <CardHeader title="Arrears state" subtitle="Derived by the engine from confirmed receipts only." />
      <CardBody>
        {!assessment ? (
          <p className="text-sm text-slate-500">Set the rent schedule to compute arrears.</p>
        ) : (
          <div>
            <div className="flex items-center gap-2">
              <ComplianceStatusChip status={assessment.status} />
              <span className="text-lg font-semibold text-slate-900">
                <Mono>{gbp(assessment.current.arrears)}</Mono>
              </span>
              <span className="text-sm text-slate-500">arrears</span>
            </div>
            <p className="mt-2 text-sm text-slate-600">{assessment.basis.summary}</p>
            <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
              <dt className="text-slate-400">Expected to date</dt>
              <dd className="text-right"><Mono>{gbp(assessment.current.expected)}</Mono></dd>
              <dt className="text-slate-400">Received (confirmed)</dt>
              <dd className="text-right"><Mono>{gbp(assessment.current.received)}</Mono></dd>
              <dt className="text-slate-400">In rent units</dt>
              <dd className="text-right"><Mono>{assessment.current.arrearsInUnits.toFixed(1)} {assessment.unit}</Mono></dd>
            </dl>
          </div>
        )}
      </CardBody>
    </Card>
  );
}

function ReceiptsCard({ propertyId, receipts }: { propertyId: string; receipts: ReceiptView[] }) {
  const router = useRouter();
  const [date, setDate] = useState("");
  const [amountGBP, setAmount] = useState<number | null>(null);
  const [reference, setReference] = useState("");
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
      <CardHeader title="Received payments" subtitle="The shared ledger. Manual entries are confirmed; bank-feed reconciliation will add confirmed receipts later." />
      <CardBody>
        {/* Add manual receipt */}
        <div className="flex flex-wrap items-end gap-2 border-b border-slate-100 pb-4">
          <label className="text-xs text-slate-500">Date<input type="date" className="input font-mono mt-1 block max-w-[10rem]" value={date} onChange={(e) => setDate(e.target.value)} /></label>
          <label className="text-xs text-slate-500">Amount (£)<input type="number" min={0} className="input font-mono mt-1 block max-w-[8rem]" value={amountGBP ?? ""} onChange={(e) => setAmount(e.target.value === "" ? null : Number(e.target.value))} /></label>
          <label className="text-xs text-slate-500">Reference<input className="input mt-1 block max-w-[12rem]" value={reference} onChange={(e) => setReference(e.target.value)} /></label>
          <Button onClick={() => run(() => addReceiptAction({ propertyId, date: date || null, amountGBP, reference: reference || null }).then((r) => { if (r.ok) { setDate(""); setAmount(null); setReference(""); } return r; }))} disabled={busy}>
            Add receipt
          </Button>
          {error ? <span className="text-sm text-red-700">{error}</span> : null}
        </div>

        {receipts.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">No payments recorded yet.</p>
        ) : (
          <ul className="mt-3 divide-y divide-slate-100">
            {receipts.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                <span className="flex items-center gap-2">
                  <Mono className="text-slate-700">{r.date}</Mono>
                  <Mono className="font-semibold text-slate-800">{gbp(r.amountGBP)}</Mono>
                  <Badge tone="neutral">{r.source.toLowerCase()}</Badge>
                  {!r.confirmed ? <Badge tone="neutral">unconfirmed</Badge> : null}
                  {r.reference ? <span className="text-slate-400">{r.reference}</span> : null}
                </span>
                <button onClick={() => run(() => removeReceiptAction({ propertyId, receiptId: r.id }))} disabled={busy} className="text-xs text-slate-400 hover:text-slate-600">
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}
      </CardBody>
    </Card>
  );
}

function Ground8Card({ propertyId, assessment }: { propertyId: string; assessment: ArrearsAssessment }) {
  const [noticeDate, setNoticeDate] = useState("");
  const [hearingDate, setHearingDate] = useState("");
  const [result, setResult] = useState<ArrearsAssessment | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function assess() {
    setError(null);
    setBusy(true);
    try {
      const r = await assessGround8Action({ propertyId, noticeDate, hearingDate });
      if (!r.ok) setError(r.error);
      else setResult(r.assessment);
    } finally {
      setBusy(false);
    }
  }

  const view = result ?? assessment;

  return (
    <Card>
      <CardHeader
        title="Section 8 Ground 8 — mandatory rent-arrears ground"
        subtitle={`At least ${assessment.thresholdUnits} ${assessment.unit}' arrears (£${assessment.thresholdAmount.toLocaleString("en-GB")}) at BOTH the notice and hearing stages.`}
      />
      <CardBody>
        <div className="flex flex-wrap items-end gap-2">
          <label className="text-xs text-slate-500">Notice date<input type="date" className="input font-mono mt-1 block max-w-[12rem]" value={noticeDate} onChange={(e) => setNoticeDate(e.target.value)} /></label>
          <label className="text-xs text-slate-500">Hearing date<input type="date" className="input font-mono mt-1 block max-w-[12rem]" value={hearingDate} onChange={(e) => setHearingDate(e.target.value)} /></label>
          <Button variant="secondary" onClick={assess} disabled={busy || !noticeDate || !hearingDate}>
            {busy ? "…" : "Assess Ground 8"}
          </Button>
          {error ? <span className="text-sm text-red-700">{error}</span> : null}
        </div>

        <div className="mt-4 space-y-2 text-sm">
          <Stage label="Notice stage" stage={view.notice} />
          <Stage label="Hearing stage" stage={view.hearing} />
          <div className="mt-2 rounded-lg bg-slate-50 px-3 py-2">
            <span className="flex items-center gap-2">
              <Glyph met={view.ground8Available} />
              <span className="font-semibold text-slate-800">
                Ground 8 {view.ground8Available ? "available" : "not available"}
              </span>
              <span className="text-slate-500">— the threshold must be met at both stages.</span>
            </span>
          </div>
        </div>
      </CardBody>
    </Card>
  );
}

function Stage({ label, stage }: { label: string; stage: { asOf: string; arrears: number; thresholdMet: boolean } | null }) {
  if (!stage) return <p className="text-slate-400">{label}: enter a date and assess.</p>;
  return (
    <span className="flex items-center gap-2">
      <Glyph met={stage.thresholdMet} />
      <span className="text-slate-700">
        {label} (<Mono>{stage.asOf}</Mono>): arrears <Mono className="font-semibold">{gbp(stage.arrears)}</Mono> —{" "}
        {stage.thresholdMet ? "threshold met" : "below threshold"}.
      </span>
    </span>
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
