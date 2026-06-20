"use client";

import { useState, useTransition } from "react";
import { Card, Badge, Button } from "@/components/ui";
import { CheckIcon } from "@/components/icons";
import { formatGBP } from "@/lib/money";
import { formatDate, formatDateTime } from "@/lib/dates";
import { submitQuarterlyUpdateAction } from "@/app/(app)/mtd/actions";
import type { MtdObligation, MtdSubmission } from "@/lib/types";

export function ObligationCard({
  obligation,
  totalIncomePence,
  totalExpensesPence,
  initialSubmission,
  inProgress,
}: {
  obligation: MtdObligation;
  totalIncomePence: number;
  totalExpensesPence: number;
  initialSubmission?: MtdSubmission;
  inProgress: boolean;
}) {
  const [submission, setSubmission] = useState<MtdSubmission | undefined>(initialSubmission);
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();

  const fulfilled = Boolean(submission);

  function submit() {
    startTransition(async () => {
      const result = await submitQuarterlyUpdateAction({
        obligationId: obligation.id,
        taxYear: obligation.taxYear,
        period: obligation.period,
        totalIncomePence,
        totalExpensesPence,
      });
      setSubmission(result);
      setConfirming(false);
    });
  }

  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-slate-900">
              {obligation.taxYear} · {obligation.period}
            </h3>
            {fulfilled ? (
              <Badge tone="success">Submitted</Badge>
            ) : inProgress ? (
              <Badge tone="info">In progress</Badge>
            ) : (
              <Badge tone="warning">Open</Badge>
            )}
          </div>
          <p className="mt-0.5 text-sm text-slate-500">
            {formatDate(obligation.startDate)} – {formatDate(obligation.endDate)} · due{" "}
            {formatDate(obligation.dueDate)}
          </p>
        </div>

        {!fulfilled && !confirming ? (
          <Button
            variant={inProgress ? "secondary" : "primary"}
            type="button"
            disabled={pending}
            onClick={() => setConfirming(true)}
          >
            Submit update
          </Button>
        ) : null}
      </div>

      <dl className="mt-4 grid grid-cols-3 gap-4 text-sm">
        <div>
          <dt className="text-slate-500">Income</dt>
          <dd className="font-semibold text-emerald-600">{formatGBP(totalIncomePence, { showPence: false })}</dd>
        </div>
        <div>
          <dt className="text-slate-500">Expenses</dt>
          <dd className="font-semibold text-slate-700">{formatGBP(totalExpensesPence, { showPence: false })}</dd>
        </div>
        <div>
          <dt className="text-slate-500">Net</dt>
          <dd className="font-semibold text-slate-900">
            {formatGBP(totalIncomePence - totalExpensesPence, { showPence: false })}
          </dd>
        </div>
      </dl>

      {confirming && !fulfilled ? (
        <div className="mt-4 rounded-lg border border-brand-200 bg-brand-50 p-4">
          <p className="text-sm text-brand-900">
            Submit this quarterly update to HMRC? Figures are taken from your digital records for the
            period.
          </p>
          <div className="mt-3 flex gap-2">
            <Button type="button" disabled={pending} title="Submit to HMRC" onClick={submit}>
              {pending ? "Submitting…" : "Confirm & submit"}
            </Button>
            <Button variant="ghost" type="button" onClick={() => setConfirming(false)}>
              Cancel
            </Button>
          </div>
        </div>
      ) : null}

      {submission ? (
        <div className="mt-4 flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          <CheckIcon className="mt-0.5 shrink-0 text-emerald-600" width={18} height={18} />
          <div>
            <p className="font-medium">Submitted to HMRC</p>
            <p className="text-emerald-800">
              Receipt <span className="font-mono">{submission.receiptRef}</span> ·{" "}
              {formatDateTime(submission.submittedAt)}
            </p>
          </div>
        </div>
      ) : null}
    </Card>
  );
}
