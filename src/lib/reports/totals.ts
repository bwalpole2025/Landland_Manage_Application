// Canonical period-totals calculations. This is the single source of truth for
// "income / expenses / net" so the dashboard P&L widget, the Annual Report and
// the cashflow reports can never drift apart. Reconciliation is by construction:
// every consumer calls these functions.

import type { Transaction } from "@/lib/types";
import { sumPence } from "@/lib/money";
import { CATEGORY_META } from "@/lib/sa105";

export interface DirectionTotals {
  incomePence: number;
  expensesPence: number;
  netPence: number;
}

/**
 * Direction-based totals over a set of rows, excluding deactivated transactions.
 * Includes every movement (finance, capital, personal, transfers) — the raw
 * cash view used by the dashboard P&L and the cashflow reports.
 */
export function directionTotals(rows: Transaction[]): DirectionTotals {
  const active = rows.filter((t) => !t.deactivated);
  const incomePence = sumPence(active.filter((t) => t.direction === "income").map((t) => t.amountPence));
  const expensesPence = sumPence(active.filter((t) => t.direction === "expense").map((t) => t.amountPence));
  return { incomePence, expensesPence, netPence: incomePence - expensesPence };
}

/**
 * Operating P&L — categorised income less allowable operating expenses only.
 * Excludes debt service (finance costs / mortgage capital) and capital
 * expenditure. Used by the Income Statement report.
 */
export function operatingPnl(rows: Transaction[]): DirectionTotals {
  const active = rows.filter((t) => !t.deactivated && t.category);
  const incomePence = sumPence(active.filter((t) => t.direction === "income").map((t) => t.amountPence));
  const expensesPence = sumPence(
    active
      .filter((t) => t.direction === "expense" && CATEGORY_META[t.category!].treatment === "allowable_expense")
      .map((t) => t.amountPence),
  );
  return { incomePence, expensesPence, netPence: incomePence - expensesPence };
}
