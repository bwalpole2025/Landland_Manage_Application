import { notFound, redirect } from "next/navigation";
import { PropertyDetail, type PropertyDetailData, type DetailTx } from "@/components/properties/PropertyDetail";
import { getSession } from "@/server/auth/session";
import {
  getActiveTenancyForProperty,
  getComplianceDocuments,
  getCurrentValuation,
  getMortgageForProperty,
  getNotes,
  getPortfolios,
  getProperty,
  getTransactions,
  getValuations,
} from "@/services/repository";
import { computeArrears } from "@/lib/arrears";
import { getPropertyPnl12m, recentTaxYears } from "@/lib/properties";
import { annualYieldPercent, loanToValuePercent, type Frequency } from "@/lib/finance";
import { taxYearFor, todayISO } from "@/lib/dates";
import { now } from "@/lib/clock";
import { categoryLabel } from "@/lib/sa105";
import { addressOneLine, PROPERTY_TYPE_LABELS, DOC_TYPE_LABELS } from "@/lib/labels";

export const dynamic = "force-dynamic";

export default async function PropertyDetailPage({ params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) redirect("/login");

  const property = getProperty(params.id);
  if (!property) notFound();

  const today = todayISO(now());
  const taxYears = recentTaxYears(taxYearFor(now()));
  const tenancy = getActiveTenancyForProperty(property.id);
  const txns = getTransactions({ propertyId: property.id });

  const valuationPence = getCurrentValuation(property.id)?.amountPence ?? null;
  const mortgage = getMortgageForProperty(property.id);
  const mortgageBalancePence = mortgage?.balancePence ?? null;
  const ltvPercent = mortgageBalancePence != null ? loanToValuePercent(mortgageBalancePence, valuationPence) : null;
  const freq: Frequency = tenancy?.rentFrequency === "weekly" ? "WEEKLY" : "MONTHLY";
  const annualYield = tenancy ? annualYieldPercent(tenancy.rentPence, freq, valuationPence) : null;

  const arrears = tenancy ? computeArrears(tenancy, getTransactions(), now()) : null;
  const tenancyTracked = txns.some((t) => t.tenancyId === tenancy?.id && t.direction === "income" && t.category === "rent" && !t.deactivated);

  const epcDoc = getComplianceDocuments(property.id).find((d) => d.type === "epc");
  const epc = epcDoc
    ? {
        rating: (epcDoc.title.match(/rating\s+([A-G])/i)?.[1] ?? "?").toUpperCase(),
        expiryDate: epcDoc.expiryDate ?? today,
        issueDate: epcDoc.issueDate,
        expired: Boolean(epcDoc.expiryDate && epcDoc.expiryDate < today),
      }
    : null;

  const transactions: DetailTx[] = txns.map((t) => ({
    id: t.id,
    date: t.date,
    description: t.description,
    categoryLabel: categoryLabel(t.category),
    direction: t.direction,
    amountPence: t.amountPence,
    reconcile: t.reconcile,
  }));

  const data: PropertyDetailData = {
    id: property.id,
    nickname: property.nickname,
    addressLine: addressOneLine(property.address),
    address: property.address,
    typeLabel: PROPERTY_TYPE_LABELS[property.type],
    bedrooms: property.bedrooms,
    archived: Boolean(property.archivedAt),
    portfolioId: property.portfolioId ?? "pf_personal",
    portfolios: getPortfolios().map((p) => ({ id: p.id, name: p.name })),
    metrics: {
      rentPence: tenancy?.rentPence ?? 0,
      annualYieldPercent: annualYield,
      mortgageBalancePence,
      valuationPence,
      purchasePricePence: property.purchasePricePence ?? null,
      ltvPercent,
    },
    purchaseDate: property.purchaseDate,
    pnl12m: getPropertyPnl12m(property.id),
    gated: session.account.subscription.status === "TRIALING",
    taxYears,
    mortgage: mortgage
      ? {
          lender: mortgage.lender,
          balancePence: mortgage.balancePence,
          monthlyPaymentPence: mortgage.monthlyPaymentPence ?? null,
          ratePct: mortgage.interestRateBps != null ? Math.round(mortgage.interestRateBps) / 100 : null,
          repaymentType: mortgage.repaymentType ?? null,
          ltvPercent,
        }
      : null,
    valuations: getValuations()
      .filter((v) => v.propertyId === property.id)
      .map((v) => ({ id: v.id, amountPence: v.amountPence, date: v.date, source: v.source })),
    tenancy: tenancy
      ? {
          tenants: tenancy.tenants.map((x) => x.name),
          rentPence: tenancy.rentPence,
          frequency: tenancy.rentFrequency,
          dueDay: tenancy.rentDueDay,
          startDate: tenancy.startDate,
          depositPence: tenancy.depositPence,
          depositScheme: tenancy.depositScheme,
          arrearsStatus: arrears?.status ?? "up_to_date",
          arrearsPence: arrears?.status === "in_arrears" ? arrears.balancePence : 0,
          lastPaymentDate: arrears?.lastPaymentDate,
        }
      : null,
    tenancyTracked,
    documents: getComplianceDocuments(property.id).map((d) => ({
      id: d.id,
      typeLabel: DOC_TYPE_LABELS[d.type],
      title: d.title,
      expiryDate: d.expiryDate,
    })),
    epc,
    notes: getNotes(property.id).map((n) => ({ id: n.id, body: n.body, author: n.author, createdAt: n.createdAt })),
    transactions,
  };

  return <PropertyDetail data={data} />;
}
