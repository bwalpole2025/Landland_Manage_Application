// Properties-screen rollups: per-property, per-tax-year income/expenses/profit
// plus current arrears, and the portfolio summary counts. Pure read-side.

import {
  getActiveTenancyForProperty,
  getPortfolios,
  getProperties,
  getTransactions,
} from "@/services/repository";
import type { Pence } from "./types";
import { sumPence } from "./money";
import { taxYearBounds, todayISO } from "./dates";
import { computeArrears } from "./arrears";
import { now as clockNow } from "./clock";

function isoMonthsAgo(now: Date, months: number): string {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - months, now.getUTCDate()));
  return d.toISOString().slice(0, 10);
}

export interface PropertyPnl {
  hasData: boolean;
  incomePence: Pence;
  expensesPence: Pence;
  profitPence: Pence;
}

/** Property-scoped Profit & Loss over the last 12 months. */
export function getPropertyPnl12m(propertyId: string, now: Date = clockNow()): PropertyPnl {
  const start = isoMonthsAgo(now, 12);
  const today = todayISO(now);
  const rows = getTransactions({ propertyId }).filter((t) => !t.deactivated && t.date >= start && t.date <= today);
  const incomePence = sumPence(rows.filter((t) => t.direction === "income").map((t) => t.amountPence));
  const expensesPence = sumPence(rows.filter((t) => t.direction === "expense").map((t) => t.amountPence));
  return { hasData: rows.length > 0, incomePence, expensesPence, profitPence: incomePence - expensesPence };
}

export interface PropertyFigures {
  incomePence: Pence;
  expensesPence: Pence;
  profitPence: Pence;
  arrearsPence: Pence; // current arrears for the active tenancy (0 if none)
}

/** Income/expenses/profit for a property in a tax year, + its current arrears. */
export function getPropertyFigures(propertyId: string, taxYear: string, now: Date = clockNow()): PropertyFigures {
  const { start, end } = taxYearBounds(taxYear);
  const rows = getTransactions({ propertyId }).filter(
    (t) => !t.deactivated && t.date >= start && t.date <= end,
  );
  const incomePence = sumPence(rows.filter((t) => t.direction === "income").map((t) => t.amountPence));
  const expensesPence = sumPence(rows.filter((t) => t.direction === "expense").map((t) => t.amountPence));

  const tenancy = getActiveTenancyForProperty(propertyId);
  const a = tenancy ? computeArrears(tenancy, getTransactions(), now) : null;
  const arrearsPence = a?.status === "in_arrears" ? a.balancePence : 0;

  return { incomePence, expensesPence, profitPence: incomePence - expensesPence, arrearsPence };
}

export interface PropertiesSummary {
  portfolioCount: number;
  propertyCount: number;
  activeTenancyCount: number;
  vacantCount: number;
  arrearsPence: Pence; // total owed across the portfolio
  creditPence: Pence; // total in credit across the portfolio
}

export function getPropertiesSummary(now: Date = clockNow()): PropertiesSummary {
  const properties = getProperties();
  const txns = getTransactions();
  let active = 0;
  let arrears = 0;
  let credit = 0;

  for (const property of properties) {
    const tenancy = getActiveTenancyForProperty(property.id);
    if (!tenancy) continue;
    active += 1;
    const a = computeArrears(tenancy, txns, now);
    if (a.status === "in_arrears") arrears += a.balancePence;
    else if (a.status === "in_credit") credit += Math.abs(a.balancePence);
  }

  return {
    portfolioCount: getPortfolios().length,
    propertyCount: properties.length,
    activeTenancyCount: active,
    vacantCount: properties.length - active,
    arrearsPence: arrears,
    creditPence: credit,
  };
}

/** Tax years offered in the filter: current down to `count-1` earlier years. */
export function recentTaxYears(currentTaxYear: string, count = 4): string[] {
  const startYear = Number(currentTaxYear.split("/")[0]);
  return Array.from({ length: count }, (_, i) => {
    const y = startYear - i;
    return `${y}/${String((y + 1) % 100).padStart(2, "0")}`;
  });
}
