import { redirect } from "next/navigation";
import { SectionCoachmark } from "@/components/coachmarks/SectionCoachmark";
import { TaxStatements, type YearStatement } from "@/components/tax/TaxStatements";
import { getSession } from "@/server/auth/session";
import { getTransactions } from "@/services/repository";
import { estimateTax } from "@/lib/tax";
import { getBeneficialOwners, estimateTaxForOwner } from "@/lib/ownership";
import { recentTaxYears } from "@/lib/properties";
import { taxYearFor } from "@/lib/dates";
import { now } from "@/lib/clock";
import { TAX_DISCLAIMER } from "@/lib/sa105";

export const dynamic = "force-dynamic";

export default async function TaxPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const currentTaxYear = taxYearFor(now());
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
