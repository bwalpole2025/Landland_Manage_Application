import { redirect } from "next/navigation";
import { PageHeader, Card, Badge } from "@/components/ui";
import { MtdPrerequisites } from "@/components/mtd/MtdPrerequisites";
import { MtdWorkspace, type ObligationView } from "@/components/mtd/MtdWorkspace";
import { HMRC_LINKS } from "@/lib/mtd-links";
import { CheckIcon, LockIcon, AlertIcon } from "@/components/icons";
import { getSession } from "@/server/auth/session";
import { getMtdObligations, getSubmissionForObligation } from "@/services/repository";
import { compilePeriodSummary, getConnection } from "@/server/mtd/service";
import { taxYearFor } from "@/lib/dates";
import { subscriptionView } from "@/lib/subscription";
import { now } from "@/lib/clock";

export const dynamic = "force-dynamic";

const STEPS = [
  {
    n: 1,
    title: "Keep digital records",
    body: "Maintain digital records of your property income and costs in compatible software.",
    items: ["Reconciled bank transactions", "Receipts", "Mortgage records", "Insurance records"],
  },
  {
    n: 2,
    title: "Submit quarterly updates",
    body: "Send HMRC a summary of income and expenses every quarter.",
    items: ["View income sources", "Submit updates", "View your tax calculation", "Allow your accountant to submit"],
  },
  {
    n: 3,
    title: "Final Declaration",
    body: "Confirm your figures after the tax year — eventually replacing the Self Assessment return.",
    items: ["Finalise the tax year", "Replaces Self Assessment over time"],
  },
];

export default async function MtdPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const taxYear = taxYearFor(now());
  const today = now().toISOString().slice(0, 10);
  const subscribed = subscriptionView(session.account.subscription, now()).entitled;

  // Quarterly periods + deadlines, each with a period summary compiled from the
  // user's categorised digital records.
  const obligations: ObligationView[] = getMtdObligations(taxYear).map((ob) => {
    const summary = compilePeriodSummary(ob.startDate, ob.endDate);
    return {
      id: ob.id,
      taxYear: ob.taxYear,
      period: ob.period,
      startDate: ob.startDate,
      endDate: ob.endDate,
      dueDate: ob.dueDate,
      inProgress: today >= ob.startDate && today <= ob.endDate,
      totalIncomePence: summary.totalIncomePence,
      totalExpensesPence: summary.totalExpensesPence,
      submission: getSubmissionForObligation(ob.id),
    };
  });

  const initialConnection = subscribed ? await getConnection(session.account.id) : null;
  const isAgent = session.role === "accountant" || session.isDelegated;

  return (
    <>
      <PageHeader
        title="Making Tax Digital for Income Tax"
        description="Keep digital records and submit quarterly updates to HMRC under MTD for Income Tax."
        actions={session.account.mtd.enrolled ? <Badge tone="success">Enrolled for MTD</Badge> : <Badge tone="warning">Not enrolled</Badge>}
      />

      {/* Education */}
      <Card>
        <div className="space-y-3 p-5 text-sm text-slate-600">
          <p>
            From <strong>April 2026</strong>, landlords with property income over the threshold
            (<strong>£50,000 a year</strong>) must follow Making Tax Digital for Income Tax (MTD for IT):
            keep <strong>digital records</strong> and send HMRC <strong>quarterly updates</strong> through
            compatible software, then a Final Declaration after the tax year.
          </p>
          <p className="text-xs text-slate-400">The threshold lowers in later years (£30,000 from April 2027, £20,000 from April 2028).</p>
        </div>
      </Card>

      {/* Three-step model */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {STEPS.map((s) => (
          <Card key={s.n} className="flex flex-col p-5">
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-100 text-sm font-bold text-brand-700">{s.n}</span>
              <h3 className="font-semibold text-slate-900">{s.title}</h3>
            </div>
            <p className="mt-2 text-sm text-slate-500">{s.body}</p>
            <ul className="mt-3 flex-1 space-y-1.5">
              {s.items.map((it) => (
                <li key={it} className="flex gap-2 text-sm text-slate-600">
                  <CheckIcon width={15} height={15} className="mt-0.5 shrink-0 text-brand-500" />
                  <span>{it}</span>
                </li>
              ))}
            </ul>
          </Card>
        ))}
      </div>

      {/* Eligibility warning */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        <span className="flex items-center gap-2">
          <AlertIcon width={18} height={18} className="shrink-0 text-amber-500" />
          Not all landlords have to (or can) join — some are exempt or excluded. Check before you sign up.
        </span>
        <a href={HMRC_LINKS.exclusions} target="_blank" rel="noopener noreferrer" className="shrink-0 font-semibold underline underline-offset-2 hover:text-amber-950">
          Check who&apos;s eligible / exempt ↗
        </a>
      </div>

      {/* Prerequisites checklist */}
      <MtdPrerequisites userId={session.user.id} subscribed={subscribed} />

      {/* Submission flow — gated behind an active subscription */}
      {subscribed ? (
        <MtdWorkspace
          taxYear={taxYear}
          obligations={obligations}
          initialConnection={initialConnection}
          canActAsAgent
          defaultAsAgent={isAgent}
        />
      ) : (
        <Card className="flex flex-col items-center justify-center px-6 py-12 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-100 text-brand-700"><LockIcon width={22} height={22} /></span>
          <p className="mt-3 text-sm font-bold uppercase tracking-wider text-brand-700">Subscribe to unlock</p>
          <p className="mt-1 max-w-md text-sm text-slate-500">
            Connecting to HMRC, submitting quarterly updates and retrieving your tax calculation requires a
            subscription.{session.account.subscription.status === "TRIALING" ? " You're currently on a free trial — subscribe to unlock it now." : ""}
          </p>
          <a href="/settings#subscription" className="mt-4 inline-flex items-center rounded-pill bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700">Subscribe — add a payment method</a>
        </Card>
      )}
    </>
  );
}
