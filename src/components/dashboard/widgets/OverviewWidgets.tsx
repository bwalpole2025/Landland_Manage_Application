import Link from "next/link";
import { Badge } from "@/components/ui";
import { formatGBP } from "@/lib/money";
import { formatDueDateShort } from "@/lib/dates";
import { Widget, WidgetEmpty, Metric, Bar } from "./Widget";
import { ArrearsList } from "./ArrearsList";
import type {
  PnlSummary,
  AssetAnalysis,
  Coverage,
  MarketRisk,
  Occupancy,
  ArrearsRow,
  RentCollection,
  UpcomingPayment,
  RentalYields,
} from "@/lib/overview";

const gbp = (p: number) => formatGBP(p, { showPence: false });
const pct = (n: number) => `${n}%`;

// --- 1. Profit & Loss (last 12 months) --------------------------------------

export function ProfitLossWidget({ pnl }: { pnl: PnlSummary }) {
  return (
    <Widget
      title="Profit & Loss analysis"
      subtitle="Last 12 months"
      action={<Link href="/reports" className="text-xs font-medium text-brand-700 hover:text-brand-800">Reports</Link>}
    >
      {!pnl.hasData ? (
        <WidgetEmpty>
          <p className="text-sm font-semibold text-slate-900">Understand your portfolio</p>
          <p className="mt-1 max-w-[16rem] text-sm text-slate-500">
            Track income and expenses to see your profit over the last 12 months.
          </p>
          <Link
            href="/transactions"
            className="mt-3 inline-flex items-center rounded-pill bg-brand-600 px-3.5 py-1.5 text-sm font-medium text-white transition hover:bg-brand-700"
          >
            Start now
          </Link>
        </WidgetEmpty>
      ) : (
        <div className="px-5 py-4">
          <div className="grid grid-cols-3 gap-3">
            <Figure label="Income" value={gbp(pnl.incomePence)} tone="positive" />
            <Figure label="Expenses" value={gbp(pnl.expensesPence)} tone="negative" />
            <Figure
              label="Profit"
              value={gbp(pnl.profitPence)}
              tone={pnl.profitPence >= 0 ? "positive" : "negative"}
            />
          </div>
          <p className="mt-3 border-t border-slate-100 pt-2 text-xs font-medium uppercase tracking-wide text-slate-400">
            Last 12 months
          </p>
        </div>
      )}
    </Widget>
  );
}

function Figure({ label, value, tone }: { label: string; value: string; tone: "positive" | "negative" }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</p>
      <p className={`mt-0.5 text-xl font-bold tracking-tight ${tone === "positive" ? "text-emerald-600" : "text-red-600"}`}>
        {value}
      </p>
    </div>
  );
}

// --- 2. Asset analysis ------------------------------------------------------

function CoverageRow({ label, coverage, noun }: { label: string; coverage: Coverage; noun: string }) {
  return (
    <div className="py-2">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-sm text-slate-600">{label}</span>
        <span className="text-sm font-semibold tabular-nums text-slate-900">
          {coverage.count > 0 ? gbp(coverage.totalPence) : "—"}
        </span>
      </div>
      <p className="text-xs text-slate-400">
        {coverage.count}/{coverage.total} {noun} have {label.toLowerCase()} data
      </p>
    </div>
  );
}

export function AssetAnalysisWidget({ asset }: { asset: AssetAnalysis }) {
  const noun = asset.propertyCount === 1 ? "property" : "properties";
  return (
    <Widget
      title="Asset analysis"
      subtitle={`${asset.propertyCount} ${noun}`}
      action={<Link href="/properties" className="text-xs font-medium text-brand-700 hover:text-brand-800">Properties</Link>}
    >
      <div className="px-5 py-4">
        <div className="flex items-baseline justify-between">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Loan to value (LTV)</p>
          {asset.ltvPercent == null ? <Badge tone="neutral">No data</Badge> : null}
        </div>
        <p className="mt-0.5 text-2xl font-bold tracking-tight text-slate-900">
          {asset.ltvPercent == null ? "—" : pct(asset.ltvPercent)}
        </p>
        <p className="text-xs text-slate-400">total mortgage ÷ total valuation</p>

        <div className="mt-3 divide-y divide-slate-100 border-t border-slate-100">
          <CoverageRow label="Valuation" coverage={asset.valuation} noun={noun} />
          <CoverageRow label="Purchase price" coverage={asset.purchasePrice} noun={noun} />
          <CoverageRow label="Mortgage balance" coverage={asset.mortgage} noun={noun} />
        </div>

        <div className="mt-4">
          <div className="mb-1 flex items-center justify-between text-xs text-slate-500">
            <span>% of portfolio data</span>
            <span className="font-semibold text-slate-700">{pct(asset.portfolioDataPercent)}</span>
          </div>
          <Bar percent={asset.portfolioDataPercent} tone={asset.portfolioDataPercent >= 75 ? "success" : "warning"} />
        </div>
      </div>
    </Widget>
  );
}

// --- 3. Occupancy -----------------------------------------------------------

export function OccupancyWidget({ occupancy }: { occupancy: Occupancy }) {
  const empty = occupancy.available === 0;
  return (
    <Widget
      title="Occupancy"
      subtitle="Across your portfolio"
      action={
        <Link href="/properties/tenancies" className="text-xs font-medium text-brand-700 hover:text-brand-800">
          + Add tenancy
        </Link>
      }
    >
      {empty ? (
        <WidgetEmpty>
          No properties yet.{" "}
          <Link href="/properties" className="font-medium text-brand-600 hover:text-brand-700">Add a property</Link>.
        </WidgetEmpty>
      ) : (
        <div className="px-5 py-4">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Occupancy</p>
          <p className="mt-0.5 text-2xl font-bold tracking-tight text-slate-900">{pct(occupancy.occupancyPercent)}</p>
          <div className="mt-3">
            <Bar percent={occupancy.occupancyPercent} tone={occupancy.occupancyPercent >= 90 ? "success" : "brand"} />
          </div>
          <dl className="mt-4 grid grid-cols-4 gap-2 text-center">
            <Count label="Available" value={occupancy.available} />
            <Count label="Occupied" value={occupancy.occupied} tone="positive" />
            <Count label="Vacant" value={occupancy.vacant} tone={occupancy.vacant > 0 ? "negative" : "default"} />
            <Count label="FHL" value={occupancy.fhl} />
          </dl>
        </div>
      )}
    </Widget>
  );
}

function Count({ label, value, tone = "default" }: { label: string; value: number; tone?: "default" | "positive" | "negative" }) {
  const cls = tone === "positive" ? "text-emerald-600" : tone === "negative" ? "text-red-600" : "text-slate-900";
  return (
    <div className="rounded-lg bg-slate-50 py-2">
      <dd className={`text-lg font-bold ${cls}`}>{value}</dd>
      <dt className="text-[11px] uppercase tracking-wide text-slate-400">{label}</dt>
    </div>
  );
}

// --- 4. Arrears -------------------------------------------------------------

export function ArrearsWidget({ arrears }: { arrears: ArrearsRow[] }) {
  const behind = arrears.filter((r) => r.status === "in_arrears").length;
  return (
    <Widget
      title="Rent arrears"
      subtitle={behind ? `${behind} tenant${behind === 1 ? "" : "s"} behind` : undefined}
      action={<Link href="/transactions" className="text-xs font-medium text-brand-700 hover:text-brand-800">View</Link>}
    >
      {arrears.length === 0 ? (
        <WidgetEmpty>🎉 No arrears — every tracked tenancy is up to date.</WidgetEmpty>
      ) : (
        <ArrearsList rows={arrears} />
      )}
    </Widget>
  );
}

// --- 5. Upcoming payments ---------------------------------------------------

export function UpcomingPaymentsWidget({ payments }: { payments: UpcomingPayment[] }) {
  return (
    <Widget
      title="Upcoming payments"
      subtitle="Next rent due"
      action={
        <Link href="/properties/tenancies" className="text-xs font-medium text-brand-700 hover:text-brand-800">
          Tenancies
        </Link>
      }
    >
      {payments.length === 0 ? (
        <WidgetEmpty>No upcoming rent — add a tenancy to track due dates.</WidgetEmpty>
      ) : (
        <ul className="divide-y divide-slate-100">
          {payments.map((p, i) => (
            <li key={`${p.propertyName}-${i}`} className="flex items-center justify-between gap-3 px-5 py-3 text-sm">
              {/* e.g. "Ben — 5th Jul — £500" */}
              <span className="flex min-w-0 items-center gap-1.5">
                <span className="truncate font-medium text-slate-900">{p.tenantName}</span>
                <span className="text-slate-300">—</span>
                <span className="shrink-0 text-slate-500">{formatDueDateShort(p.dueDate)}</span>
              </span>
              <span className="shrink-0 font-semibold text-slate-700">{gbp(p.amountPence)}</span>
            </li>
          ))}
        </ul>
      )}
    </Widget>
  );
}

// --- 6. Rent collection -----------------------------------------------------

export function RentCollectionWidget({ collection }: { collection: RentCollection }) {
  return (
    <Widget
      title="Rent collection"
      subtitle={collection.month}
      locked={!collection.hasData}
      action={
        <Link href="/transactions" className="text-xs font-medium text-brand-700 hover:text-brand-800">
          Review transactions
        </Link>
      }
    >
      <div className="px-5 py-4">
        <div className="flex items-baseline justify-between">
          <p className="text-2xl font-bold tracking-tight text-slate-900">{pct(collection.percent)}</p>
          <p className="text-xs text-slate-500">collected this month</p>
        </div>
        <div className="mt-3">
          <Bar percent={collection.percent} tone={collection.percent >= 100 ? "success" : collection.percent >= 60 ? "brand" : "warning"} />
        </div>
        <div className="mt-3 divide-y divide-slate-100 border-t border-slate-100">
          <Metric label="Collected" value={gbp(collection.receivedPence)} tone="positive" />
          <Metric label="Expected" value={gbp(collection.expectedPence)} />
        </div>
      </div>
    </Widget>
  );
}

// --- 7. Market risk (valuation vs purchase price) ---------------------------

export function MarketRiskWidget({ risk }: { risk: MarketRisk }) {
  const up = risk.equityGainPence >= 0;
  return (
    <Widget
      title="Market risk"
      subtitle="Valuation vs purchase price"
      locked={!risk.hasData}
      lockHeading="Add financial data"
      lockMessage="Add property valuations and purchase prices to assess market movement."
      lockCtaLabel="Add financial data"
      lockCtaHref="/properties"
    >
      <div className="px-5 py-4">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Capital growth since purchase</p>
        <p className={`mt-0.5 text-2xl font-bold tracking-tight ${up ? "text-emerald-600" : "text-red-600"}`}>
          {risk.growthPercent == null ? "—" : `${up ? "+" : ""}${risk.growthPercent}%`}
        </p>
        <div className="mt-3 divide-y divide-slate-100 border-t border-slate-100">
          <Metric label="Current valuation" value={gbp(risk.totalValuationPence)} />
          <Metric label="Purchase price" value={gbp(risk.totalPurchasePence)} />
          <Metric label="Equity gain" value={`${up ? "+" : ""}${gbp(risk.equityGainPence)}`} tone={up ? "positive" : "negative"} />
        </div>
      </div>
    </Widget>
  );
}

// --- 8. Rental yields -------------------------------------------------------

export function RentalYieldsWidget({ yields }: { yields: RentalYields }) {
  const max = yields.rows.reduce((m, r) => Math.max(m, r.yieldPercent), 0) || 1;
  return (
    <Widget
      title="Rental yields"
      subtitle={`Expected gross yield · ${yields.taxYear}`}
      locked={yields.locked}
      lockMessage="Track a rental payment and enter purchase prices to unlock expected yields."
    >
      {yields.rows.length === 0 ? (
        <WidgetEmpty>Add a purchase price and an active tenancy to calculate yields.</WidgetEmpty>
      ) : (
        <div className="px-5 py-4">
          <div className="flex items-baseline justify-between">
            <p className="text-2xl font-bold tracking-tight text-slate-900">
              {yields.averagePercent != null ? `${yields.averagePercent}%` : "—"}
            </p>
            <p className="text-xs text-slate-500">avg · on {yields.basis === "valuation" ? "valuation" : "purchase price"}</p>
          </div>
          <ul className="mt-3 space-y-2 border-t border-slate-100 pt-3">
            {yields.rows.map((r) => (
              <li key={r.propertyName}>
                <div className="mb-1 flex items-center justify-between gap-3 text-sm">
                  <span className="truncate text-slate-600">{r.propertyName}</span>
                  <span className="shrink-0 font-semibold tabular-nums text-slate-900">{r.yieldPercent}%</span>
                </div>
                <Bar percent={(r.yieldPercent / max) * 100} tone="brand" />
              </li>
            ))}
          </ul>
        </div>
      )}
    </Widget>
  );
}
