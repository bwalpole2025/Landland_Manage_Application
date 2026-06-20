import { SectionCoachmark } from "@/components/coachmarks/SectionCoachmark";
import {
  OwnershipScreen,
  type PortfolioRow,
  type OwnerRow,
  type CompanyRow,
} from "@/components/properties/OwnershipScreen";
import { getCompanies, getCompany, getPortfolios, getProperties } from "@/services/repository";
import { getBeneficialOwners, getOwnerSplit, getPortfolioOwnership } from "@/lib/ownership";
import { taxYearFor } from "@/lib/dates";
import { now } from "@/lib/clock";

export const dynamic = "force-dynamic";

export default function OwnershipPage() {
  const taxYear = taxYearFor(now());
  const properties = getProperties();

  const portfolios: PortfolioRow[] = getPortfolios().map((pf) => {
    const o = getPortfolioOwnership(pf.id);
    return {
      id: pf.id,
      name: pf.name,
      type: pf.type,
      isDefault: Boolean(pf.isDefault),
      companyName: getCompany(pf.companyId)?.name,
      propertyCount: o.propertyCount,
      ownerCount: o.ownerCount,
    };
  });

  const owners: OwnerRow[] = getBeneficialOwners().map((o) => ({
    id: o.id,
    name: o.name,
    holdings: o.holdings.map((h) => ({ propertyId: h.propertyId, propertyName: h.propertyName, sharePercent: h.sharePercent })),
    split: (() => {
      const s = getOwnerSplit(o.id, taxYear);
      return { incomePence: s.incomePence, expensesPence: s.expensesPence, profitPence: s.profitPence, estimatedTaxPence: s.estimatedTaxPence };
    })(),
  }));

  const companies: CompanyRow[] = getCompanies().map((c) => {
    const portfolio = getPortfolios().find((pf) => pf.companyId === c.id);
    const propertyCount = portfolio ? properties.filter((p) => (p.portfolioId ?? "pf_personal") === portfolio.id).length : 0;
    return {
      id: c.id,
      name: c.name,
      companyNumber: c.companyNumber,
      incorporationDate: c.incorporationDate,
      directorsLoanBalancePence: c.directorsLoanBalancePence,
      portfolioName: portfolio?.name,
      propertyCount,
    };
  });

  const propertyPortfolio = Object.fromEntries(properties.map((p) => [p.id, p.portfolioId ?? "pf_personal"]));

  return (
    <>
      <SectionCoachmark section="ownership" />
      <OwnershipScreen
        portfolios={portfolios}
        owners={owners}
        companies={companies}
        properties={properties.map((p) => ({ id: p.id, name: p.nickname }))}
        propertyPortfolio={propertyPortfolio}
        taxYear={taxYear}
      />
    </>
  );
}
