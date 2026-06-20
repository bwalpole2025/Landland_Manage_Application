// Simplified SA105 tax-estimate engine.
//
// IMPORTANT: this is a deliberately simplified, year-to-date ESTIMATE for the
// in-app figure — not a tax computation and not advice (see TAX_DISCLAIMER).
// Simplifications: assumes property profit is the taxpayer's only income, uses
// a flat personal allowance and basic rate, and applies the 20% finance-cost
// (mortgage interest) relief that replaced full deduction.

import type { Sa105Box, TaxEstimate, Transaction } from "./types";
import { CATEGORY_META } from "./sa105";
import { taxYearBounds } from "./dates";
import { sumPence } from "./money";

// 2026/27 indicative figures.
const PERSONAL_ALLOWANCE_PENCE = 1_257_000; // £12,570
const BASIC_RATE = 0.2;
const FINANCE_COST_RELIEF_RATE = 0.2;

function inTaxYear(t: Transaction, taxYear: string): boolean {
  const { start, end } = taxYearBounds(taxYear);
  return t.date >= start && t.date <= end;
}

export function estimateTax(allTransactions: Transaction[], taxYear: string): TaxEstimate {
  const rows = allTransactions.filter((t) => inTaxYear(t, taxYear) && t.category);

  const income = rows.filter((t) => t.direction === "income");
  const expenses = rows.filter((t) => t.direction === "expense");

  const totalIncomePence = sumPence(income.map((t) => t.amountPence));

  const financeCostsPence = sumPence(
    expenses.filter((t) => t.category && CATEGORY_META[t.category].isFinanceCost).map((t) => t.amountPence),
  );
  const deductibleExpensesPence = sumPence(
    expenses.filter((t) => t.category && !CATEGORY_META[t.category].isFinanceCost).map((t) => t.amountPence),
  );

  const totalExpensesPence = deductibleExpensesPence + financeCostsPence;

  // Profit excludes finance costs (those get relief, not deduction).
  const taxableProfitPence = Math.max(0, totalIncomePence - deductibleExpensesPence);

  const afterAllowance = Math.max(0, taxableProfitPence - PERSONAL_ALLOWANCE_PENCE);
  const taxBeforeReliefPence = Math.round(afterAllowance * BASIC_RATE);
  const financeReliefPence = Math.round(financeCostsPence * FINANCE_COST_RELIEF_RATE);
  const estimatedTaxPence = Math.max(0, taxBeforeReliefPence - financeReliefPence);

  return {
    taxYear,
    totalIncomePence,
    totalExpensesPence,
    financeCostsPence,
    taxableProfitPence,
    estimatedTaxPence,
    boxes: buildBoxes(rows),
  };
}

function buildBoxes(rows: Transaction[]): Sa105Box[] {
  const byBox = new Map<string, { label: string; amount: number }>();
  for (const t of rows) {
    if (!t.category) continue;
    const meta = CATEGORY_META[t.category];
    const existing = byBox.get(meta.sa105Box);
    const amount = (existing?.amount ?? 0) + t.amountPence;
    byBox.set(meta.sa105Box, { label: meta.sa105BoxLabel, amount });
  }
  return [...byBox.entries()]
    .map(([box, v]) => ({ box, label: v.label, amountPence: v.amount }))
    .sort((a, b) => Number(a.box) - Number(b.box));
}
