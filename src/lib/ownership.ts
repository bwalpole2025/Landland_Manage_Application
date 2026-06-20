// Ownership model + pro-rata tax apportionment.
//
// Ownership is recorded per property (Property.ownership: who holds what %).
// The Tax module can then split each property's taxable income and allowable
// expenses by an owner's percentage and produce a per-owner tax statement.

import { getProperties, getProperty, getTransactions, getUser } from "@/services/repository";
import type { TaxEstimate, Transaction } from "./types";
import { estimateTax } from "./tax";
import { taxYearFor } from "./dates";
import { now as clockNow } from "./clock";

/** Owner's percentage share of a property (0 if they hold none). */
export function ownerShareOfProperty(ownerId: string, propertyId: string): number {
  const property = getProperty(propertyId);
  return property?.ownership.find((o) => o.userId === ownerId)?.share ?? 0;
}

export interface OwnerHolding {
  propertyId: string;
  propertyName: string;
  portfolioId?: string;
  sharePercent: number;
}

export interface BeneficialOwner {
  id: string;
  name: string;
  holdings: OwnerHolding[];
}

/** Distinct beneficial owners across active properties, with their holdings. */
export function getBeneficialOwners(): BeneficialOwner[] {
  const byOwner = new Map<string, OwnerHolding[]>();
  for (const property of getProperties()) {
    for (const o of property.ownership) {
      const list = byOwner.get(o.userId) ?? [];
      list.push({ propertyId: property.id, propertyName: property.nickname, portfolioId: property.portfolioId, sharePercent: o.share });
      byOwner.set(o.userId, list);
    }
  }
  return [...byOwner.entries()]
    .map(([id, holdings]) => ({ id, name: getUser(id)?.name ?? id, holdings }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export interface PortfolioOwnership {
  propertyCount: number;
  ownerCount: number;
  ownerIds: string[];
}

/** Property count + distinct beneficial-owner count for a portfolio. */
export function getPortfolioOwnership(portfolioId: string): PortfolioOwnership {
  const props = getProperties().filter((p) => (p.portfolioId ?? "pf_personal") === portfolioId);
  const owners = new Set<string>();
  for (const p of props) for (const o of p.ownership) owners.add(o.userId);
  return { propertyCount: props.length, ownerCount: owners.size, ownerIds: [...owners] };
}

/**
 * Scale each property-assigned transaction by the owner's share of that
 * property — the pro-rata apportionment the per-owner tax estimate runs on.
 */
export function apportionTransactionsForOwner(ownerId: string, all: Transaction[]): Transaction[] {
  return all.flatMap((t) => {
    if (!t.propertyId) return []; // unassigned → default portfolio, handled elsewhere
    const share = ownerShareOfProperty(ownerId, t.propertyId);
    if (share <= 0) return [];
    return [{ ...t, amountPence: Math.round((t.amountPence * share) / 100) }];
  });
}

/** A beneficial owner's pro-rata SA105 tax statement for a tax year. */
export function estimateTaxForOwner(ownerId: string, taxYear: string): TaxEstimate {
  return estimateTax(apportionTransactionsForOwner(ownerId, getTransactions()), taxYear);
}

export interface OwnerTaxSplit {
  ownerId: string;
  name: string;
  incomePence: number;
  expensesPence: number;
  profitPence: number;
  estimatedTaxPence: number;
}

export function getOwnerSplit(ownerId: string, taxYear: string = taxYearFor(clockNow())): OwnerTaxSplit {
  const est = estimateTaxForOwner(ownerId, taxYear);
  return {
    ownerId,
    name: getUser(ownerId)?.name ?? ownerId,
    incomePence: est.totalIncomePence,
    expensesPence: est.totalExpensesPence,
    profitPence: est.taxableProfitPence,
    estimatedTaxPence: est.estimatedTaxPence,
  };
}

/** Per-owner splits for everyone with a holding, for the Tax module. */
export function getAllOwnerSplits(taxYear: string = taxYearFor(clockNow())): OwnerTaxSplit[] {
  return getBeneficialOwners().map((o) => getOwnerSplit(o.id, taxYear));
}
