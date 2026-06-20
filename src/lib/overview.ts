// Aggregations powering the Overview dashboard widgets. Pure read-side rollups
// over the repository; all money is integer pence. Each function returns a
// plain, serialisable shape so widgets can be server components.

import {
  getActiveTenancyForProperty,
  getCurrentValuation,
  getMortgageForProperty,
  getProperties,
  getTransactions,
} from "@/services/repository";
import type { Pence, Tenancy } from "./types";
import { sumPence } from "./money";
import { computeArrears, rentDueDateOf } from "./arrears";
import { addressOneLine } from "./labels";
import { annualYieldPercent, loanToValuePercent, type Frequency } from "./finance";
import { now as clockNow } from "./clock";
import { todayISO, taxYearFor } from "./dates";

/** Current valuation amount for a property, or null when none is recorded. */
function valuationPence(propertyId: string): Pence | null {
  return getCurrentValuation(propertyId)?.amountPence ?? null;
}

/** Outstanding mortgage balance for a property, or null when none is recorded. */
function mortgageBalancePence(propertyId: string): Pence | null {
  return getMortgageForProperty(propertyId)?.balancePence ?? null;
}

function freq(t: Tenancy): Frequency {
  return t.rentFrequency === "weekly" ? "WEEKLY" : "MONTHLY";
}

function monthlyEquivalent(t: Tenancy): Pence {
  return t.rentFrequency === "weekly" ? Math.round((t.rentPence * 52) / 12) : t.rentPence;
}

function isoMonthsAgo(now: Date, months: number): string {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - months, now.getUTCDate()));
  return d.toISOString().slice(0, 10);
}

// --- Profit & Loss (last 12 months) -----------------------------------------

export interface PnlSummary {
  hasData: boolean;
  incomePence: Pence;
  expensesPence: Pence;
  profitPence: Pence;
}

export function getLast12MonthsPnl(now: Date = clockNow()): PnlSummary {
  const start = isoMonthsAgo(now, 12);
  const today = todayISO(now);
  const rows = getTransactions().filter((t) => !t.deactivated && t.date >= start && t.date <= today);
  const incomePence = sumPence(rows.filter((t) => t.direction === "income").map((t) => t.amountPence));
  const expensesPence = sumPence(rows.filter((t) => t.direction === "expense").map((t) => t.amountPence));
  return { hasData: rows.length > 0, incomePence, expensesPence, profitPence: incomePence - expensesPence };
}

// --- Asset analysis ----------------------------------------------------------

export interface Coverage {
  count: number; // properties with this datum
  total: number; // total properties
  percent: number; // 0–100
  totalPence: Pence; // sum across covered properties
}

export interface AssetAnalysis {
  propertyCount: number;
  /** Total mortgage balance ÷ total valuation, portfolio-wide. Null when no valuation. */
  ltvPercent: number | null;
  valuation: Coverage;
  purchasePrice: Coverage;
  mortgage: Coverage;
  /** Overall data completeness across the three signals above (0–100). */
  portfolioDataPercent: number;
}

export function getAssetAnalysis(): AssetAnalysis {
  const properties = getProperties();
  const n = properties.length;

  function coverage(amountFor: (id: string) => Pence | null): Coverage {
    const amounts = properties.map((p) => amountFor(p.id)).filter((v): v is number => v != null);
    return {
      count: amounts.length,
      total: n,
      percent: n === 0 ? 0 : Math.round((amounts.length / n) * 100),
      totalPence: sumPence(amounts),
    };
  }

  const valuation = coverage(valuationPence);
  const purchasePrice = coverage((id) => getProperties().find((p) => p.id === id)?.purchasePricePence ?? null);
  const mortgage = coverage(mortgageBalancePence);

  return {
    propertyCount: n,
    ltvPercent:
      valuation.totalPence > 0 ? loanToValuePercent(mortgage.totalPence, valuation.totalPence) : null,
    valuation,
    purchasePrice,
    mortgage,
    portfolioDataPercent: Math.round((valuation.percent + purchasePrice.percent + mortgage.percent) / 3),
  };
}

// --- Market risk (valuation vs purchase price) ------------------------------

export interface MarketRisk {
  /** True once valuations exist to compare against purchase prices. */
  hasData: boolean;
  totalValuationPence: Pence;
  totalPurchasePence: Pence;
  /** Valuation − purchase price across properties with both figures. */
  equityGainPence: Pence;
  /** Capital growth since purchase, as a percentage. Null without data. */
  growthPercent: number | null;
}

export function getMarketRisk(): MarketRisk {
  // Only compare properties that have BOTH a valuation and a purchase price.
  let totalValuation = 0;
  let totalPurchase = 0;
  let comparable = 0;
  for (const p of getProperties()) {
    const val = valuationPence(p.id);
    if (val == null || p.purchasePricePence == null) continue;
    totalValuation += val;
    totalPurchase += p.purchasePricePence;
    comparable += 1;
  }
  return {
    hasData: comparable > 0,
    totalValuationPence: totalValuation,
    totalPurchasePence: totalPurchase,
    equityGainPence: totalValuation - totalPurchase,
    growthPercent:
      totalPurchase > 0 ? Math.round(((totalValuation - totalPurchase) / totalPurchase) * 10000) / 100 : null,
  };
}

// --- Occupancy ---------------------------------------------------------------

export interface Occupancy {
  available: number; // total lettable units
  occupied: number;
  vacant: number;
  fhl: number; // furnished holiday lets
  occupancyPercent: number;
}

export function getOccupancy(): Occupancy {
  const properties = getProperties();
  const available = properties.length;
  const occupied = properties.filter((p) => getActiveTenancyForProperty(p.id)).length;
  const vacant = available - occupied;
  return {
    available,
    occupied,
    vacant,
    fhl: 0, // no FHL classification in the dataset yet
    occupancyPercent: available === 0 ? 0 : Math.round((occupied / available) * 100),
  };
}

// --- Arrears -----------------------------------------------------------------

export interface ArrearsRow {
  tenancyId: string;
  propertyId: string;
  propertyName: string;
  propertyAddress: string;
  tenantName: string;
  /** "untracked" when no rent has been tracked for this tenancy yet. */
  status: "in_arrears" | "untracked";
  balancePence: Pence;
  monthsBehind: number;
  rentPence: Pence;
  /** Rent due-dates in the window that aren't covered by a matched payment. */
  missingDueDates: string[];
}

/** Has any rent payment been tracked for this tenancy? */
function rentTracked(tenancyId: string): boolean {
  return getTransactions().some(
    (t) => t.tenancyId === tenancyId && t.direction === "income" && t.category === "rent" && !t.deactivated,
  );
}

export function getArrearsList(now: Date = clockNow()): ArrearsRow[] {
  const txns = getTransactions();
  const rows: ArrearsRow[] = [];

  for (const property of getProperties()) {
    const tenancy = getActiveTenancyForProperty(property.id);
    if (!tenancy) continue;

    const base = {
      tenancyId: tenancy.id,
      propertyId: property.id,
      propertyName: property.nickname,
      propertyAddress: addressOneLine(property.address),
      tenantName: tenancy.tenants[0]?.name ?? "Tenant",
      rentPence: tenancy.rentPence,
    };

    // Rent tracking hasn't started for this tenancy → "Untracked".
    if (!rentTracked(tenancy.id)) {
      rows.push({ ...base, status: "untracked", balancePence: 0, monthsBehind: 0, missingDueDates: [] });
      continue;
    }

    const a = computeArrears(tenancy, txns, now);
    if (a.status !== "in_arrears") continue; // healthy tenancies aren't listed

    // Greedily treat the earliest due-dates as covered; the rest are missing.
    const covered = tenancy.rentPence > 0 ? Math.floor(a.receivedPence / tenancy.rentPence) : 0;
    const missingDueDates = a.dueDatesInWindow.slice(covered);

    rows.push({
      ...base,
      status: "in_arrears",
      balancePence: a.balancePence,
      monthsBehind: a.monthsBehind,
      missingDueDates,
    });
  }

  // Arrears first (largest balance), then untracked.
  return rows.sort((x, y) => {
    if (x.status !== y.status) return x.status === "in_arrears" ? -1 : 1;
    return y.balancePence - x.balancePence;
  });
}

// --- Rent collection (current calendar month) --------------------------------

export interface RentCollection {
  hasData: boolean;
  month: string; // e.g. "June 2026"
  expectedPence: Pence;
  receivedPence: Pence;
  percent: number; // 0–100, capped
}

export function getRentCollection(now: Date = clockNow()): RentCollection {
  const txns = getTransactions();
  const year = now.getUTCFullYear();
  const month0 = now.getUTCMonth(); // 0–11
  const start = `${year}-${String(month0 + 1).padStart(2, "0")}-01`;
  const lastDay = new Date(Date.UTC(year, month0 + 1, 0)).getUTCDate();
  const end = `${year}-${String(month0 + 1).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
  const monthLabel = new Date(Date.UTC(year, month0, 1)).toLocaleDateString("en-GB", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });

  // Expected: one month's rent for each active tenancy.
  let expected = 0;
  for (const property of getProperties()) {
    const tenancy = getActiveTenancyForProperty(property.id);
    if (tenancy) expected += monthlyEquivalent(tenancy);
  }

  // Collected: rent income whose rent DUE date falls in the current month
  // (not the bank date — these can differ).
  const received = sumPence(
    txns
      .filter(
        (t) =>
          t.direction === "income" &&
          t.category === "rent" &&
          !t.deactivated &&
          rentDueDateOf(t) >= start &&
          rentDueDateOf(t) <= end,
      )
      .map((t) => t.amountPence),
  );

  const percent = expected === 0 ? 0 : Math.min(100, Math.round((received / expected) * 100));
  return {
    hasData: txns.length > 0 && expected > 0,
    month: monthLabel,
    expectedPence: expected,
    receivedPence: received,
    percent,
  };
}

// --- Upcoming payments -------------------------------------------------------

export interface UpcomingPayment {
  propertyName: string;
  tenantName: string;
  dueDate: string; // ISO
  amountPence: Pence;
}

function nextDueDate(dueDay: number, now: Date): string {
  const today = now.getUTCDate();
  let year = now.getUTCFullYear();
  let month = now.getUTCMonth(); // 0–11
  if (dueDay <= today) {
    month += 1;
    if (month > 11) {
      month = 0;
      year += 1;
    }
  }
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const day = Math.min(dueDay, lastDay);
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function getUpcomingPayments(now: Date = clockNow(), limit = 5): UpcomingPayment[] {
  return getProperties()
    .flatMap((property) => {
      const tenancy = getActiveTenancyForProperty(property.id);
      if (!tenancy) return [];
      return [
        {
          propertyName: property.nickname,
          tenantName: tenancy.tenants[0]?.name ?? "Tenant",
          dueDate: nextDueDate(tenancy.rentDueDay, now),
          amountPence: tenancy.rentPence,
        },
      ];
    })
    .sort((a, b) => (a.dueDate < b.dueDate ? -1 : 1))
    .slice(0, limit);
}

// --- Rental yields -----------------------------------------------------------

/** Has the user tracked at least one rental payment (rent income)? */
export function hasRentalPaymentTracked(): boolean {
  return getTransactions().some((t) => t.direction === "income" && t.category === "rent");
}

export interface YieldRow {
  propertyName: string;
  yieldPercent: number;
}

export interface RentalYields {
  /** Locked until a rental payment is tracked and purchase prices are entered. */
  locked: boolean;
  taxYear: string;
  rows: YieldRow[];
  averagePercent: number | null;
  /** Yields prefer the current valuation, falling back to purchase price. */
  basis: "purchase_price" | "valuation";
}

export function getRentalYields(now: Date = clockNow()): RentalYields {
  const taxYear = taxYearFor(now);
  const properties = getProperties();
  const anyPurchasePrice = properties.some((p) => p.purchasePricePence != null);
  const locked = !hasRentalPaymentTracked() || !anyPurchasePrice;

  const rows: YieldRow[] = [];
  let usedValuationForAll = true;
  for (const property of properties) {
    const tenancy = getActiveTenancyForProperty(property.id);
    const basisPence = valuationPence(property.id) ?? property.purchasePricePence ?? null;
    if (!tenancy || basisPence == null) continue;
    if (valuationPence(property.id) == null) usedValuationForAll = false;
    const y = annualYieldPercent(tenancy.rentPence, freq(tenancy), basisPence);
    if (y != null) rows.push({ propertyName: property.nickname, yieldPercent: y });
  }
  rows.sort((a, b) => b.yieldPercent - a.yieldPercent);
  const averagePercent = rows.length
    ? Math.round((rows.reduce((s, r) => s + r.yieldPercent, 0) / rows.length) * 100) / 100
    : null;

  return {
    locked,
    taxYear,
    rows,
    averagePercent,
    basis: rows.length && usedValuationForAll ? "valuation" : "purchase_price",
  };
}

// --- Portfolio rent roll (used by occupancy/footer) --------------------------

export function getMonthlyRentRoll(): Pence {
  return getProperties().reduce((sum, p) => {
    const t = getActiveTenancyForProperty(p.id);
    return sum + (t ? monthlyEquivalent(t) : 0);
  }, 0);
}
