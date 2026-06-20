// Pure, composable transaction filtering for the ledger. Each set field
// narrows the result; unset fields are ignored. All filters AND together.

import type { Transaction, TransactionCategory, TransactionDirection } from "./types";

export interface TxFilters {
  /** Bank account id, or "manual" for manually-entered items. */
  source?: string;
  propertyId?: string;
  tenancyId?: string;
  type?: TransactionDirection;
  category?: TransactionCategory;
  minPence?: number;
  maxPence?: number;
}

export const EMPTY_FILTERS: TxFilters = {};

export function filterTransactions(rows: Transaction[], f: TxFilters): Transaction[] {
  return rows.filter((t) => {
    if (f.source) {
      if (f.source === "manual" ? t.source !== "manual" : t.bankAccountId !== f.source) return false;
    }
    if (f.propertyId && t.propertyId !== f.propertyId) return false;
    if (f.tenancyId && t.tenancyId !== f.tenancyId) return false;
    if (f.type && t.direction !== f.type) return false;
    if (f.category && t.category !== f.category) return false;
    if (f.minPence != null && t.amountPence < f.minPence) return false;
    if (f.maxPence != null && t.amountPence > f.maxPence) return false;
    return true;
  });
}

/** True when any filter is active (used to enable "Clear filters"). */
export function hasActiveFilters(f: TxFilters): boolean {
  return Boolean(
    f.source || f.propertyId || f.tenancyId || f.type || f.category || f.minPence != null || f.maxPence != null,
  );
}
