import { redirect } from "next/navigation";
import { PageHeader, Badge } from "@/components/ui";
import { SectionCoachmark } from "@/components/coachmarks/SectionCoachmark";
import { ReportsExplorer } from "@/components/reports/ReportsExplorer";
import { LockedOverlay } from "@/components/billing/LockedOverlay";
import { getSession } from "@/server/auth/session";
import { buildDataset } from "@/server/reports/service";
import type { ReportFilters } from "@/lib/reports/build";
import { taxYearBounds, taxYearFor } from "@/lib/dates";
import { subscriptionView } from "@/lib/subscription";
import { now } from "@/lib/clock";

export const dynamic = "force-dynamic";

export default async function ReportsPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const taxYear = taxYearFor(now());
  const { start, end } = taxYearBounds(taxYear);
  const defaultFilters: ReportFilters = { from: start, to: end, portfolioId: "" };
  const entitled = subscriptionView(session.account.subscription, now()).entitled;

  return (
    <>
      <SectionCoachmark section="reports" />
      <PageHeader
        title="Reports"
        description="A catalogue of report types — filter by date range and portfolio, view on screen, and export to PDF or CSV."
        actions={<Badge tone="neutral">Tax year {taxYear}</Badge>}
      />
      {entitled ? (
        // Premium data is only built/sent when the account is entitled.
        <ReportsExplorer dataset={buildDataset()} defaultFilters={defaultFilters} />
      ) : (
        <LockedOverlay
          variant="data"
          canManageBilling={session.role === "owner"}
          message="Reports unlock when you subscribe. Add a payment method to view and export your full financial reports."
        />
      )}
    </>
  );
}
