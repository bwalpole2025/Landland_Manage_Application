import { redirect } from "next/navigation";
import { OverviewHeader } from "@/components/dashboard/OverviewHeader";
import { TutorialBanner } from "@/components/dashboard/TutorialBanner";
import { OnboardingChecklist, type OnboardingStep } from "@/components/dashboard/OnboardingChecklist";
import {
  ProfitLossWidget,
  AssetAnalysisWidget,
  OccupancyWidget,
  ArrearsWidget,
  UpcomingPaymentsWidget,
  RentCollectionWidget,
  MarketRiskWidget,
  RentalYieldsWidget,
} from "@/components/dashboard/widgets/OverviewWidgets";
import { getSession } from "@/server/auth/session";
import { getActiveTenancyForProperty, getProperties, getTransactions } from "@/services/repository";
import {
  getArrearsList,
  getAssetAnalysis,
  getLast12MonthsPnl,
  getMarketRisk,
  getOccupancy,
  getRentalYields,
  getRentCollection,
  getUpcomingPayments,
} from "@/lib/overview";

export const dynamic = "force-dynamic";

export default async function OverviewPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  // --- Onboarding checklist (derived from real data) ---
  const properties = getProperties();
  const hasTenancy = properties.some((p) => getActiveTenancyForProperty(p.id));
  const transactionCount = getTransactions().length;
  const steps: OnboardingStep[] = [
    {
      key: "property",
      label: "Property added",
      description: "Your first property is the foundation of everything else.",
      href: "/properties",
      done: properties.length > 0,
    },
    {
      key: "tenancy",
      label: "Tenancy added",
      description: "Record the tenant, rent amount and due date.",
      href: "/properties/tenancies",
      done: hasTenancy,
    },
    {
      key: "transaction",
      label: "Track a rental transaction",
      description: "Log rent received or an expense — or let the bank feed do it.",
      href: "/transactions",
      done: transactionCount > 0,
      count: transactionCount,
    },
  ];

  // --- Widget aggregations ---
  const pnl = getLast12MonthsPnl();
  const asset = getAssetAnalysis();
  const occupancy = getOccupancy();
  const arrears = getArrearsList();
  const upcoming = getUpcomingPayments();
  const collection = getRentCollection();
  const yields = getRentalYields();
  const marketRisk = getMarketRisk();

  return (
    <>
      <OverviewHeader />

      <TutorialBanner userId={session.user.id} />

      <OnboardingChecklist steps={steps} emailVerified={session.user.emailVerified} userId={session.user.id} />

      {/* Responsive widget grid: 1 col on mobile, 2 on md, 3 on xl. */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        <ProfitLossWidget pnl={pnl} />
        <OccupancyWidget occupancy={occupancy} />
        <RentCollectionWidget collection={collection} />

        <AssetAnalysisWidget asset={asset} />
        <RentalYieldsWidget yields={yields} />
        <MarketRiskWidget risk={marketRisk} />

        <div className="md:col-span-2">
          <ArrearsWidget arrears={arrears} />
        </div>
        <UpcomingPaymentsWidget payments={upcoming} />
      </div>
    </>
  );
}
