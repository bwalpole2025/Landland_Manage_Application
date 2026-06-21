// Portfolio-level rollups shared by the dashboard and reports.

import {
  getActiveTenancyForProperty,
  getProperties,
  getTenancies,
  getTransactions,
} from "@/services/repository";
import type { Pence, Property, Transaction } from "./types";
import { taxYearBounds } from "./dates";
import { directionTotals, type DirectionTotals } from "./reports/totals";

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

export type Totals = DirectionTotals;

// Shared canonical calculation — keeps the dashboard P&L and the reports in lock-step.
const totalsFor = (rows: Transaction[]): Totals => directionTotals(rows);

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
