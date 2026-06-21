import { redirect } from "next/navigation";
import { PageHeader } from "@/components/ui";
import { SectionCoachmark } from "@/components/coachmarks/SectionCoachmark";
import { TaxStatements, type YearStatement } from "@/components/tax/TaxStatements";
import { LockedOverlay } from "@/components/billing/LockedOverlay";
import { getSession } from "@/server/auth/session";
import { getTransactions } from "@/services/repository";
import { estimateTax } from "@/lib/tax";
import { getBeneficialOwners, estimateTaxForOwner } from "@/lib/ownership";
import { recentTaxYears } from "@/lib/properties";
import { taxYearFor } from "@/lib/dates";
import { subscriptionView } from "@/lib/subscription";
import { now } from "@/lib/clock";
import { TAX_DISCLAIMER } from "@/lib/sa105";

export const dynamic = "force-dynamic";

export default async function TaxPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const currentTaxYear = taxYearFor(now());

  // Tax figures are premium data — gate them rather than computing/sending when
  // the account isn't entitled.
  if (!subscriptionView(session.account.subscription, now()).entitled) {
    return (
      <>
        <SectionCoachmark section="tax" />
        <PageHeader title="Tax" description="SA105 income-tax estimates for your portfolio and each owner." />
        <LockedOverlay
          variant="data"
          canManageBilling={session.role === "owner"}
          message="Your tax estimates unlock when you subscribe. Add a payment method to see your SA105 figures and per-owner splits."
        />
      </>
    );
  }

  const years = recentTaxYears(currentTaxYear);
  const owners = getBeneficialOwners();

  // Pre-compute each tax year's estimate, both whole-account and per-owner.
  const statements: YearStatement[] = years.map((taxYear) => ({
    taxYear,
    total: estimateTax(getTransactions(), taxYear),
    owners: owners.map((o) => ({ ownerId: o.id, name: o.name, estimate: estimateTaxForOwner(o.id, taxYear) })),
  }));

  return (
    <>
      <SectionCoachmark section="tax" />
      <TaxStatements
        userId={session.user.id}
        currentTaxYear={currentTaxYear}
        statements={statements}
        owners={owners.map((o) => ({ id: o.id, name: o.name }))}
        disclaimer={TAX_DISCLAIMER}
      />
    </>
  );
}
