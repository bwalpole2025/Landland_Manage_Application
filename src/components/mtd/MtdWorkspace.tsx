"use client";

import { useState, useTransition } from "react";
import { Card, CardHeader, Badge, Button } from "@/components/ui";
import { CheckIcon, LockIcon, AlertIcon } from "@/components/icons";
import { formatGBP } from "@/lib/money";
import { formatDate, formatDateTime } from "@/lib/dates";
import {
  beginAuthorizationAction,
  completeAuthorizationAction,
  disconnectAction,
  submitQuarterlyUpdateAction,
  getTaxCalculationAction,
  submitFinalDeclarationAction,
} from "@/app/(app)/mtd/actions";
import type { MtdConnection } from "@/server/mtd/service";
import type { TaxCalculationDTO } from "@/server/providers/hmrc-mtd";
import type { MtdSubmission } from "@/lib/types";

export interface ObligationView {
  id: string;
  taxYear: string;
  period: string;
  startDate: string;
  endDate: string;
  dueDate: string;
  inProgress: boolean;
  totalIncomePence: number;
  totalExpensesPence: number;
  submission?: MtdSubmission;
}

interface Props {
  taxYear: string;
  obligations: ObligationView[];
  initialConnection: MtdConnection | null;
  canActAsAgent: boolean;
  defaultAsAgent: boolean;
}

const gbp = (p: number) => formatGBP(p, { showPence: false });

function ErrorNote({ error }: { error?: { code: string; message: string } }) {
  if (!error) return null;
  return (
    <div className="mt-3 flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
      <AlertIcon width={16} height={16} className="mt-0.5 shrink-0 text-rose-500" />
      <span><span className="font-mono text-xs">{error.code}</span> — {error.message}</span>
    </div>
  );
}

export function MtdWorkspace({ taxYear, obligations, initialConnection, canActAsAgent, defaultAsAgent }: Props) {
  const [connection, setConnection] = useState<MtdConnection | null>(initialConnection);
  const [asAgent, setAsAgent] = useState(defaultAsAgent);
  const [calculation, setCalculation] = useState<TaxCalculationDTO | null>(null);
  const connected = Boolean(connection?.connected);

  return (
    <>
      <ConnectionPanel connection={connection} setConnection={setConnection} />

      {connected ? (
        <>
          {canActAsAgent ? <AgentToggle asAgent={asAgent} setAsAgent={setAsAgent} /> : null}

          <Card>
            <CardHeader title="Quarterly obligations" subtitle={`Tax year ${taxYear} · periods and deadlines from HMRC`} />
            <div className="grid grid-cols-1 gap-4 p-5 md:grid-cols-2">
              {obligations.map((o) => (
                <ObligationItem key={o.id} obligation={o} asAgent={asAgent} />
              ))}
            </div>
          </Card>

          <CalculationPanel taxYear={taxYear} asAgent={asAgent} calculation={calculation} setCalculation={setCalculation} />

          <FinalDeclarationPanel taxYear={taxYear} asAgent={asAgent} calculation={calculation} />
        </>
      ) : (
        <Card className="px-6 py-8 text-center text-sm text-slate-500">
          Authorise the app with HMRC above to view your obligations, submit quarterly updates and
          retrieve your tax calculation.
        </Card>
      )}
    </>
  );
}

// --- OAuth connection ------------------------------------------------------

function ConnectionPanel({ connection, setConnection }: { connection: MtdConnection | null; setConnection: (c: MtdConnection | null) => void }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<{ code: string; message: string }>();
  const connected = Boolean(connection?.connected);

  function authorise() {
    setError(undefined);
    start(async () => {
      // Begin the OAuth flow. In production this URL is HMRC's consent screen and
      // the user is redirected to /api/mtd/callback; in the sandbox we complete
      // the handshake directly with a simulated authorization code.
      await beginAuthorizationAction();
      const res = await completeAuthorizationAction("sandbox-auth-code");
      if (res.ok) setConnection(res.data);
      else setError(res.error);
    });
  }

  function disconnect() {
    start(async () => {
      await disconnectAction();
      setConnection(null);
    });
  }

  return (
    <Card>
      <CardHeader
        title="Connect to HMRC"
        subtitle="Authorise PropManage to file on your behalf using OAuth — we never see your Government Gateway password."
        action={connected ? <Badge tone="success">Connected</Badge> : <Badge tone="warning">Not connected</Badge>}
      />
      <div className="p-5">
        {connected && connection ? (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="space-y-1 text-sm text-slate-600">
              <p className="flex items-center gap-1.5"><CheckIcon width={15} height={15} className="text-emerald-600" /> Authorised via OAuth. Tokens are stored securely and refreshed automatically.</p>
              <p className="text-xs text-slate-400">Scope <span className="font-mono">{connection.scope}</span> · access token expires {formatDateTime(connection.expiresAt)}</p>
            </div>
            <Button variant="secondary" onClick={disconnect} disabled={pending}>Disconnect</Button>
          </div>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="max-w-xl text-sm text-slate-600">
              You&apos;ll be taken to HMRC&apos;s secure sign-in to grant access. PropManage receives only an
              authorisation token — your Government Gateway user ID and password stay with HMRC.
            </p>
            <Button onClick={authorise} disabled={pending}>{pending ? "Authorising…" : "Authorise with HMRC"}</Button>
          </div>
        )}
        <ErrorNote error={error} />
      </div>
    </Card>
  );
}

// --- Delegated (agent) submission ------------------------------------------

function AgentToggle({ asAgent, setAsAgent }: { asAgent: boolean; setAsAgent: (v: boolean) => void }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3">
      <span className="text-sm text-slate-600">Submitting as</span>
      <div className="flex rounded-pill bg-slate-100 p-1 text-sm">
        <button onClick={() => setAsAgent(false)} className={`rounded-pill px-3 py-1 ${!asAgent ? "bg-white font-medium text-slate-900 shadow-sm" : "text-slate-500"}`}>The landlord</button>
        <button onClick={() => setAsAgent(true)} className={`rounded-pill px-3 py-1 ${asAgent ? "bg-white font-medium text-slate-900 shadow-sm" : "text-slate-500"}`}>Accountant (agent)</button>
      </div>
    </div>
  );
}

// --- One obligation: compiled summary + confirm + submit -------------------

function ObligationItem({ obligation: o, asAgent }: { obligation: ObligationView; asAgent: boolean }) {
  const [submission, setSubmission] = useState<MtdSubmission | undefined>(o.submission);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<{ code: string; message: string }>();
  const [pending, start] = useTransition();
  const fulfilled = Boolean(submission);

  function submit() {
    setError(undefined);
    start(async () => {
      const res = await submitQuarterlyUpdateAction({
        obligationId: o.id, taxYear: o.taxYear, period: o.period, startDate: o.startDate, endDate: o.endDate, asAgent,
      });
      if (res.ok) { setSubmission(res.data); setConfirming(false); }
      else setError(res.error);
    });
  }

  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-slate-900">{o.taxYear} · {o.period}</h3>
            {fulfilled ? <Badge tone="success">Submitted</Badge> : o.inProgress ? <Badge tone="info">In progress</Badge> : <Badge tone="warning">Open</Badge>}
          </div>
          <p className="mt-0.5 text-sm text-slate-500">{formatDate(o.startDate)} – {formatDate(o.endDate)} · due {formatDate(o.dueDate)}</p>
        </div>
        {!fulfilled && !confirming ? <Button variant={o.inProgress ? "secondary" : "primary"} disabled={pending} onClick={() => setConfirming(true)}>Submit update</Button> : null}
      </div>

      <dl className="mt-4 grid grid-cols-3 gap-4 text-sm">
        <div><dt className="text-slate-500">Income</dt><dd className="font-semibold text-emerald-600">{gbp(o.totalIncomePence)}</dd></div>
        <div><dt className="text-slate-500">Expenses</dt><dd className="font-semibold text-slate-700">{gbp(o.totalExpensesPence)}</dd></div>
        <div><dt className="text-slate-500">Net</dt><dd className="font-semibold text-slate-900">{gbp(o.totalIncomePence - o.totalExpensesPence)}</dd></div>
      </dl>

      {confirming && !fulfilled ? (
        <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-4">
          <p className="flex items-start gap-1.5 text-sm text-amber-900">
            <AlertIcon width={16} height={16} className="mt-0.5 shrink-0 text-amber-500" />
            <span>Submit this quarterly update to HMRC{asAgent ? " as the landlord's agent" : ""}? This is an <strong>irreversible</strong> filing of {gbp(o.totalIncomePence)} income and {gbp(o.totalExpensesPence)} expenses compiled from your digital records.</span>
          </p>
          <div className="mt-3 flex gap-2">
            <Button disabled={pending} onClick={submit}>{pending ? "Submitting…" : "Confirm & submit to HMRC"}</Button>
            <Button variant="ghost" onClick={() => setConfirming(false)}>Cancel</Button>
          </div>
        </div>
      ) : null}

      {submission ? (
        <div className="mt-4 flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          <CheckIcon className="mt-0.5 shrink-0 text-emerald-600" width={18} height={18} />
          <div>
            <p className="font-medium">Submitted to HMRC</p>
            <p className="text-emerald-800">Receipt <span className="font-mono">{submission.receiptRef}</span> · {formatDateTime(submission.submittedAt)}</p>
          </div>
        </div>
      ) : null}
      <ErrorNote error={error} />
    </Card>
  );
}

// --- Tax calculation -------------------------------------------------------

function CalculationPanel({ taxYear, asAgent, calculation, setCalculation }: { taxYear: string; asAgent: boolean; calculation: TaxCalculationDTO | null; setCalculation: (c: TaxCalculationDTO | null) => void }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<{ code: string; message: string }>();

  function retrieve() {
    setError(undefined);
    start(async () => {
      const res = await getTaxCalculationAction(taxYear, asAgent);
      if (res.ok) setCalculation(res.data);
      else setError(res.error);
    });
  }

  return (
    <Card>
      <CardHeader
        title="Tax calculation"
        subtitle="HMRC's own calculation for the year to date, based on your submitted updates."
        action={<Button variant="secondary" disabled={pending} onClick={retrieve}>{pending ? "Retrieving…" : calculation ? "Refresh calculation" : "Retrieve tax calculation"}</Button>}
      />
      <div className="p-5">
        {calculation ? (
          <div>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <Stat label="Taxable profit" value={gbp(calculation.taxableProfitMinor)} />
              <Stat label="Income tax" value={gbp(calculation.incomeTaxMinor)} />
              <Stat label="Class 4 NIC" value={gbp(calculation.class4NicMinor)} />
              <Stat label="Total due" value={gbp(calculation.totalDueMinor)} accent />
            </div>
            <p className="mt-3 text-xs text-slate-400">Calculation <span className="font-mono">{calculation.calculationId}</span> · {formatDateTime(calculation.calculatedAt)}</p>
            {calculation.messages.map((m, i) => (
              <p key={i} className="mt-2 text-sm text-slate-500">ℹ {m.text}</p>
            ))}
          </div>
        ) : (
          <p className="text-sm text-slate-500">Retrieve HMRC&apos;s tax calculation to see your estimated income tax and Class 4 NIC for {taxYear}.</p>
        )}
        <ErrorNote error={error} />
      </div>
    </Card>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className={`rounded-xl border p-4 ${accent ? "border-amber-200 bg-amber-50" : "border-slate-200 bg-white"}`}>
      <p className="text-xs uppercase tracking-wide text-slate-400">{label}</p>
      <p className={`mt-1 text-lg font-bold ${accent ? "text-amber-900" : "text-slate-900"}`}>{value}</p>
    </div>
  );
}

// --- End-of-Period Statement & Final Declaration ---------------------------

function FinalDeclarationPanel({ taxYear, asAgent, calculation }: { taxYear: string; asAgent: boolean; calculation: TaxCalculationDTO | null }) {
  const [confirming, setConfirming] = useState(false);
  const [receipt, setReceipt] = useState<{ receiptRef: string; submittedAt: string }>();
  const [error, setError] = useState<{ code: string; message: string }>();
  const [pending, start] = useTransition();

  function submit() {
    if (!calculation) return;
    setError(undefined);
    start(async () => {
      const res = await submitFinalDeclarationAction(taxYear, calculation.calculationId, asAgent);
      if (res.ok) { setReceipt(res.data); setConfirming(false); }
      else setError(res.error);
    });
  }

  return (
    <Card>
      <CardHeader title="End-of-Period Statement & Final Declaration" subtitle="The year-end steps that finalise your figures and replace Self Assessment." />
      <div className="space-y-3 p-5 text-sm text-slate-600">
        <p>After your four quarterly updates you confirm each income source (End-of-Period Statement), then make a single <strong>Final Declaration</strong> for the tax year. Retrieve your tax calculation first.</p>

        {receipt ? (
          <div className="flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-emerald-900">
            <CheckIcon className="mt-0.5 shrink-0 text-emerald-600" width={18} height={18} />
            <div><p className="font-medium">Final Declaration submitted for {taxYear}</p><p className="text-emerald-800">Receipt <span className="font-mono">{receipt.receiptRef}</span> · {formatDateTime(receipt.submittedAt)}</p></div>
          </div>
        ) : confirming ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-900">
            <p className="flex items-start gap-1.5"><AlertIcon width={16} height={16} className="mt-0.5 shrink-0 text-amber-500" /><span>Submit your Final Declaration for {taxYear}{asAgent ? " as agent" : ""}? You are confirming the figures are correct and complete — this is <strong>irreversible</strong>.</span></p>
            <div className="mt-3 flex gap-2">
              <Button disabled={pending} onClick={submit}>{pending ? "Submitting…" : "Confirm Final Declaration"}</Button>
              <Button variant="ghost" onClick={() => setConfirming(false)}>Cancel</Button>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <Button disabled={!calculation} onClick={() => setConfirming(true)}>Make Final Declaration</Button>
            {!calculation ? <span className="flex items-center gap-1 text-xs text-slate-400"><LockIcon width={13} height={13} /> retrieve your tax calculation first</span> : null}
          </div>
        )}
        <ErrorNote error={error} />
      </div>
    </Card>
  );
}
