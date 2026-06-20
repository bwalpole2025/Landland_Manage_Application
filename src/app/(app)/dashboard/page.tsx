import Link from "next/link";
import { redirect } from "next/navigation";
import { PageHeader, StatTile, Card, CardHeader, Badge, Button } from "@/components/ui";
import { OnboardingChecklist, type OnboardingStep } from "@/components/dashboard/OnboardingChecklist";
import { AlertsPanel } from "@/components/dashboard/AlertsPanel";
import { DashboardStats } from "@/components/dashboard/DashboardStats";
import { getSession } from "@/server/auth/session";
import { getAlerts } from "@/lib/alerts";
import {
  getActiveTenancyForProperty,
  getBankAccounts,
  getProperties,
  getTransactions,
} from "@/services/repository";
import { computeArrears } from "@/lib/arrears";
import { getPortfolioSummary, getYtdTotals } from "@/lib/portfolio";
import { estimateTax } from "@/lib/tax";
import { formatGBP } from "@/lib/money";
import { taxYearFor, formatDate } from "@/lib/dates";
import { now } from "@/lib/clock";
import { categoryLabel } from "@/lib/sa105";

export default async function DashboardPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  const taxYear = taxYearFor(now());
  const alerts = getAlerts();

  const summary = getPortfolioSummary();
  const ytd = getYtdTotals(taxYear);
  const tax = estimateTax(getTransactions(), taxYear);

  // Total rent arrears across the portfolio.
  const arrearsTotal = getProperties().reduce((total, property) => {
    const tenancy = getActiveTenancyForProperty(property.id);
    if (!tenancy) return total;
    const a = computeArrears(tenancy, getTransactions());
    return total + (a.status === "in_arrears" ? a.balancePence : 0);
  }, 0);

  // Onboarding completion derived from real data.
  const properties = getProperties();
  const hasTenancy = properties.some((p) => getActiveTenancyForProperty(p.id));
  const banks = getBankAccounts();
  const banksAllConnected = banks.length > 0 && banks.every((b) => b.status === "connected");
  const steps: OnboardingStep[] = [
    {
      key: "property",
      label: "Add a property",
      description: "Your first property is the foundation of everything else.",
      href: "/properties",
      done: properties.length > 0,
    },
    {
      key: "tenancy",
      label: "Add a tenancy",
      description: "Record the tenant, rent amount and due date.",
      href: "/properties",
      done: hasTenancy,
    },
    {
      key: "transaction",
      label: "Track a rental transaction",
      description: "Log rent received or an expense — or let the bank feed do it.",
      href: "/transactions",
      done: getTransactions().length > 0,
    },
    {
      key: "bank",
      label: "Connect your bank feeds",
      description: banksAllConnected
        ? "All accounts connected."
        : "One account needs re-authorising to keep syncing automatically.",
      href: "/transactions",
      done: banksAllConnected,
    },
  ];

  const recent = getTransactions().slice(0, 6);

  return (
    <>
      <PageHeader
        title={`Welcome back, ${session.user.name.split(" ")[0]}`}
        description={`Here's how ${session.account.name} is doing this tax year (${taxYear}).`}
        actions={<Button href="/properties">Add property</Button>}
      />

      <OnboardingChecklist steps={steps} />

      <DashboardStats />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          label="Monthly rent roll"
          value={formatGBP(summary.rentRollPence, { showPence: false })}
          sub={`${summary.occupiedCount}/${summary.propertyCount} occupied`}
          tone="brand"
        />
        <StatTile
          label={`Net income (${taxYear})`}
          value={formatGBP(ytd.netPence, { showPence: false })}
          sub={`${formatGBP(ytd.incomePence, { showPence: false })} in · ${formatGBP(ytd.expensesPence, { showPence: false })} out`}
          tone={ytd.netPence >= 0 ? "success" : "danger"}
        />
        <StatTile
          label="Rent arrears"
          value={formatGBP(arrearsTotal, { showPence: false })}
          sub={arrearsTotal > 0 ? "Action needed" : "All up to date"}
          tone={arrearsTotal > 0 ? "danger" : "success"}
        />
        <StatTile
          label="Estimated tax"
          value={formatGBP(tax.estimatedTaxPence, { showPence: false })}
          sub="Estimate · not advice"
          tone="warning"
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <AlertsPanel alerts={alerts} />

          <Card>
            <CardHeader
              title="Recent activity"
              subtitle="Latest transactions from your bank feed and manual entries"
              action={<Button variant="secondary" href="/transactions">View all</Button>}
            />
            <ul className="divide-y divide-slate-100">
              {recent.map((t) => (
                <li key={t.id} className="flex items-center justify-between gap-3 px-5 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-900">{t.description}</p>
                    <p className="text-xs text-slate-500">
                      {formatDate(t.date)} · {categoryLabel(t.category)}
                      {t.reconcile === "unreconciled" ? (
                        <span className="ml-2">
                          <Badge tone="warning">Needs review</Badge>
                        </span>
                      ) : null}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 text-sm font-semibold ${
                      t.direction === "income" ? "text-emerald-600" : "text-slate-700"
                    }`}
                  >
                    {t.direction === "income" ? "+" : "−"}
                    {formatGBP(t.amountPence)}
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader title="Quick actions" />
            <div className="flex flex-col gap-2 p-4">
              <Button variant="secondary" href="/transactions">Reconcile transactions</Button>
              <Button variant="secondary" href="/tax">Review tax estimate</Button>
              <Button variant="secondary" href="/mtd">Submit MTD update</Button>
              <Button variant="secondary" href="/files">Manage certificates</Button>
            </div>
          </Card>

          <Card>
            <CardHeader title="MTD for IT" />
            <div className="space-y-2 p-5 text-sm text-slate-600">
              <p>
                Account status:{" "}
                {session.account.mtd.enrolled ? (
                  <Badge tone="success">Enrolled</Badge>
                ) : (
                  <Badge tone="warning">Not enrolled</Badge>
                )}
              </p>
              <p>Keep digital records and file quarterly updates with HMRC.</p>
              <Link href="/mtd" className="inline-block font-medium text-brand-700 hover:text-brand-800">
                Go to MTD →
              </Link>
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}
