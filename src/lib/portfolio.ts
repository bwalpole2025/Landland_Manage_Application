// Portfolio-level rollups shared by the dashboard and reports.

import {
  getActiveTenancyForProperty,
  getProperties,
  getTenancies,
  getTransactions,
} from "@/services/repository";
import type { Pence, Property, Transaction } from "./types";
import { taxYearBounds } from "./dates";
import { sumPence } from "./money";

export interface PortfolioSummary {
  propertyCount: number;
  occupiedCount: number;
  vacantCount: number;
  /** Combined monthly rent for active tenancies (monthly equivalent). */
  rentRollPence: Pence;
}

export function getPortfolioSummary(): PortfolioSummary {
  const properties = getProperties();
  let occupied = 0;
  let rentRoll = 0;
  for (const property of properties) {
    const tenancy = getActiveTenancyForProperty(property.id);
    if (tenancy) {
      occupied += 1;
      rentRoll += tenancy.rentFrequency === "weekly" ? Math.round((tenancy.rentPence * 52) / 12) : tenancy.rentPence;
    }
  }
  return {
    propertyCount: properties.length,
    occupiedCount: occupied,
    vacantCount: properties.length - occupied,
    rentRollPence: rentRoll,
  };
}

export interface Totals {
  incomePence: Pence;
  expensesPence: Pence;
  netPence: Pence;
}

function totalsFor(rows: Transaction[]): Totals {
  const incomePence = sumPence(rows.filter((t) => t.direction === "income").map((t) => t.amountPence));
  const expensesPence = sumPence(rows.filter((t) => t.direction === "expense").map((t) => t.amountPence));
  return { incomePence, expensesPence, netPence: incomePence - expensesPence };
}

export function getYtdTotals(taxYear: string): Totals {
  const { start, end } = taxYearBounds(taxYear);
  const rows = getTransactions().filter((t) => t.date >= start && t.date <= end);
  return totalsFor(rows);
}

export interface PropertyPnl extends Totals {
  property: Property;
}

export function getPerPropertyPnl(taxYear: string): PropertyPnl[] {
  const { start, end } = taxYearBounds(taxYear);
  const all = getTransactions().filter((t) => t.date >= start && t.date <= end);
  return getProperties()
    .map((property) => ({
      property,
      ...totalsFor(all.filter((t) => t.propertyId === property.id)),
    }))
    .sort((a, b) => b.netPence - a.netPence);
}

export { getTenancies };
