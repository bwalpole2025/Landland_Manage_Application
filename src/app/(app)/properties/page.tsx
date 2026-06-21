import { redirect } from "next/navigation";
import { SectionCoachmark } from "@/components/coachmarks/SectionCoachmark";
import {
  PropertiesScreen,
  type PropertyCardData,
  type InsuranceRow,
  type MortgageRow,
} from "@/components/properties/PropertiesScreen";
import { getSession } from "@/server/auth/session";
import {
  getActiveTenancyForProperty,
  getCurrentValuation,
  getInsurancePolicies,
  getMortgages,
  getPortfolio,
  getPortfolios,
  getProperties,
  getProperty,
} from "@/services/repository";
import { getPropertiesSummary, getPropertyFigures, recentTaxYears } from "@/lib/properties";
import { loanToValuePercent } from "@/lib/finance";
import { taxYearFor, todayISO } from "@/lib/dates";
import { subscriptionView } from "@/lib/subscription";
import { now } from "@/lib/clock";
import { addressOneLine, PROPERTY_TYPE_LABELS, INSURANCE_TYPE_LABELS } from "@/lib/labels";

export const dynamic = "force-dynamic";

export default async function PropertiesPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const taxYear = taxYearFor(now());
  const taxYears = recentTaxYears(taxYear);
  const properties = getProperties();
  const today = todayISO(now());

  const cards: PropertyCardData[] = properties.map((p) => {
    const tenancy = getActiveTenancyForProperty(p.id);
    const portfolio = getPortfolio(p.portfolioId);
    const figuresByYear = Object.fromEntries(taxYears.map((y) => [y, getPropertyFigures(p.id, y)]));
    return {
      id: p.id,
      nickname: p.nickname,
      addressLine: addressOneLine(p.address),
      typeLabel: PROPERTY_TYPE_LABELS[p.type],
      bedrooms: p.bedrooms,
      portfolioId: p.portfolioId ?? "pf_personal",
      portfolioName: portfolio?.name ?? "Default portfolio",
      occupied: Boolean(tenancy),
      rentPence: tenancy?.rentPence ?? 0,
      figuresByYear,
    };
  });

  const insurance: InsuranceRow[] = getInsurancePolicies().map((i) => {
    const property = getProperty(i.propertyId);
    return {
      id: i.id,
      propertyId: i.propertyId,
      propertyName: property?.nickname ?? "Property",
      portfolioId: property?.portfolioId ?? "pf_personal",
      typeLabel: INSURANCE_TYPE_LABELS[i.type],
      provider: i.provider,
      expiryDate: i.expiryDate,
      expired: i.expiryDate < today,
    };
  });

  const mortgages: MortgageRow[] = getMortgages().map((m) => {
    const property = getProperty(m.propertyId);
    const valuation = getCurrentValuation(m.propertyId)?.amountPence;
    return {
      id: m.id,
      propertyId: m.propertyId,
      propertyName: property?.nickname ?? "Property",
      portfolioId: property?.portfolioId ?? "pf_personal",
      lender: m.lender,
      balancePence: m.balancePence,
      monthlyPaymentPence: m.monthlyPaymentPence ?? null,
      ratePct: m.interestRateBps != null ? Math.round(m.interestRateBps) / 100 : null,
      ltvPercent: loanToValuePercent(m.balancePence, valuation),
    };
  });

  const portfolios = getPortfolios().map((p) => ({ id: p.id, name: p.name }));
  const summary = getPropertiesSummary();
  const gated = !subscriptionView(session.account.subscription, now()).entitled;

  return (
    <>
      <SectionCoachmark section="properties" />
      <PropertiesScreen
        summary={summary}
        portfolios={portfolios}
        taxYears={taxYears}
        cards={cards}
        insurance={insurance}
        mortgages={mortgages}
        gated={gated}
      />
    </>
  );
}
