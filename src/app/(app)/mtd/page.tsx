import { PageHeader, Card, CardHeader, Badge, Disclaimer } from "@/components/ui";
import { redirect } from "next/navigation";
import { ObligationCard } from "@/components/mtd/ObligationCard";
import { getSession } from "@/server/auth/session";
import {
  getMtdObligations,
  getSubmissionForObligation,
  getTransactions,
} from "@/services/repository";
import { taxYearFor, formatDate } from "@/lib/dates";
import { now } from "@/lib/clock";
import { sumPence } from "@/lib/money";

export default async function MtdPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  const taxYear = taxYearFor(now());
  const today = now().toISOString().slice(0, 10);

  // Current-year obligations, earliest first.
  const obligations = getMtdObligations(taxYear);
  const allTx = getTransactions();

  function periodTotals(start: string, end: string) {
    const rows = allTx.filter((t) => t.date >= start && t.date <= end);
    return {
      income: sumPence(rows.filter((t) => t.direction === "income").map((t) => t.amountPence)),
      expenses: sumPence(rows.filter((t) => t.direction === "expense").map((t) => t.amountPence)),
    };
  }

  return (
    <>
      <PageHeader
        title="Making Tax Digital"
        description="Keep digital records and submit quarterly updates to HMRC for Income Tax (MTD for IT)."
        actions={
          session.account.mtd.enrolled ? (
            <Badge tone="success">Enrolled for MTD</Badge>
          ) : (
            <Badge tone="warning">Not enrolled</Badge>
          )
        }
      />

      <Disclaimer>
        Submissions are made to HMRC&apos;s MTD service. In this build the HMRC integration is mocked —
        no data leaves your device — but the submit flow and digital-record requirements are
        fully wired behind the service interface.
      </Disclaimer>

      <Card>
        <CardHeader
          title="Quarterly obligations"
          subtitle={`Tax year ${taxYear} · UTR ${maskUtr(session.account.mtd.utr)}`}
        />
        <div className="grid grid-cols-1 gap-4 p-5 md:grid-cols-2">
          {obligations.map((ob) => {
            const totals = periodTotals(ob.startDate, ob.endDate);
            const inProgress = today >= ob.startDate && today <= ob.endDate;
            return (
              <ObligationCard
                key={ob.id}
                obligation={ob}
                totalIncomePence={totals.income}
                totalExpensesPence={totals.expenses}
                initialSubmission={getSubmissionForObligation(ob.id)}
                inProgress={inProgress}
              />
            );
          })}
        </div>
      </Card>

      <Card>
        <CardHeader title="Filing history" subtitle="Previously submitted updates" />
        <FilingHistory taxYear={taxYear} />
      </Card>
    </>
  );
}

function FilingHistory({ taxYear }: { taxYear: string }) {
  // Show fulfilled obligations across all years with their receipts.
  const obligations = getMtdObligations().filter(
    (o) => getSubmissionForObligation(o.id) || o.status === "fulfilled",
  );
  if (obligations.length === 0) {
    return <div className="px-5 py-6 text-sm text-slate-500">No updates filed yet.</div>;
  }
  return (
    <ul className="divide-y divide-slate-100">
      {obligations.map((o) => {
        const sub = getSubmissionForObligation(o.id);
        return (
          <li key={o.id} className="flex items-center justify-between gap-3 px-5 py-3 text-sm">
            <div>
              <p className="font-medium text-slate-900">
                {o.taxYear} · {o.period}
                {o.taxYear === taxYear ? <span className="ml-2 text-xs text-slate-400">current year</span> : null}
              </p>
              <p className="text-xs text-slate-500">Period ended {formatDate(o.endDate)}</p>
            </div>
            <div className="text-right">
              <Badge tone="success">Submitted</Badge>
              {sub ? <p className="mt-1 font-mono text-xs text-slate-400">{sub.receiptRef}</p> : null}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function maskUtr(utr?: string): string {
  if (!utr) return "—";
  return `••••${utr.slice(-4)}`;
}
