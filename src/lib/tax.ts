// UK property (SA105) tax-estimate engine.
//
// IMPORTANT: a simplified forecast for the in-app figure — not a tax computation
// and not advice (see TAX_DISCLAIMER). All rates, allowances and thresholds come
// from the versioned, per-tax-year table in tax-config.ts — never hard-coded.
//
// Method:
//   taxable rental income = allowable income − allowable expenses
//     (finance costs are NOT deducted here — they get a basic-rate reducer)
//   income tax is banded (basic / higher / additional) after the personal
//   allowance (which tapers above £100k), then the finance-cost reducer is
//   subtracted as a tax reduction.

import type { Sa105Box, Sa105ExpenseLine, TaxBand, TaxEstimate, Transaction } from "./types";
import { CATEGORY_META, categoryLabel } from "./sa105";
import { getTaxConfig, type TaxYearConfig } from "./tax-config";
import { taxYearBounds } from "./dates";
import { sumPence } from "./money";

function inTaxYear(t: Transaction, taxYear: string): boolean {
  const { start, end } = taxYearBounds(taxYear);
  return t.date >= start && t.date <= end;
}

/** Banded income tax on taxable profit (treated as the only income). */
function computeIncomeTax(taxableProfitPence: number, c: TaxYearConfig): { taxPence: number; band: TaxBand } {
  // Personal allowance tapers £1 for every £2 of income over the threshold.
  let pa = c.personalAllowancePence;
  if (taxableProfitPence > c.personalAllowanceTaperThresholdPence) {
    pa = Math.max(0, pa - Math.floor((taxableProfitPence - c.personalAllowanceTaperThresholdPence) / 2));
  }
  const taxable = Math.max(0, taxableProfitPence - pa);
  if (taxable === 0) return { taxPence: 0, band: "none" };

  // Bands measured on taxable income (after the allowance).
  const additionalBandStart = c.additionalRateThresholdPence - c.personalAllowancePence; // ≈ £112,570
  const basic = Math.min(taxable, c.basicRateBandPence);
  const higher = Math.max(0, Math.min(taxable, additionalBandStart) - c.basicRateBandPence);
  const additional = Math.max(0, taxable - additionalBandStart);
  const taxPence = Math.round(basic * c.basicRate + higher * c.higherRate + additional * c.additionalRate);
  const band: TaxBand = additional > 0 ? "additional" : higher > 0 ? "higher" : "basic";
  return { taxPence, band };
}

export function estimateTax(allTransactions: Transaction[], taxYear: string): TaxEstimate {
  const config = getTaxConfig(taxYear);

  // Only categorised, active transactions in the year. Deposits (excluded) and
  // capital expenses are not part of the SA105 income/expense computation.
  const rows = allTransactions.filter((t) => inTaxYear(t, taxYear) && t.category && !t.deactivated);
  const treatmentOf = (t: Transaction) => CATEGORY_META[t.category!].treatment;

  // --- Income (SA105 structure: rents / premiums / other) ---
  const sumCat = (cat: string) => sumPence(rows.filter((t) => t.category === cat).map((t) => t.amountPence));
  const income = {
    rentsReceivedPence: sumCat("rent"),
    premiumsPence: 0, // no lease-premium category seeded; structure reserves the box
    otherIncomePence: sumCat("other_property_income"),
  };
  const totalIncomePence = income.rentsReceivedPence + income.premiumsPence + income.otherIncomePence;

  // --- Expenses by category (allowable only; finance costs handled separately) ---
  const byCat = new Map<string, number>();
  for (const t of rows) {
    if (treatmentOf(t) !== "allowable_expense") continue;
    byCat.set(t.category!, (byCat.get(t.category!) ?? 0) + t.amountPence);
  }
  const allowableExpenses: Sa105ExpenseLine[] = [...byCat.entries()]
    .map(([category, amountPence]) => ({
      category: category as Sa105ExpenseLine["category"],
      label: categoryLabel(category as Sa105ExpenseLine["category"]),
      sa105Box: CATEGORY_META[category as Sa105ExpenseLine["category"]].sa105Box,
      amountPence,
    }))
    .sort((a, b) => Number(a.sa105Box) - Number(b.sa105Box));
  const deductibleExpensesPence = sumPence(allowableExpenses.map((e) => e.amountPence));

  const financeCostsPence = sumPence(rows.filter((t) => treatmentOf(t) === "finance_cost").map((t) => t.amountPence));
  const totalExpensesPence = deductibleExpensesPence + financeCostsPence;

  // Taxable rental income excludes finance costs (relieved, not deducted).
  const taxableProfitPence = Math.max(0, totalIncomePence - deductibleExpensesPence);

  const { taxPence: taxBeforeReliefPence, band } = computeIncomeTax(taxableProfitPence, config);
  // Finance-cost reducer: basic rate on the lower of finance costs and profit.
  const financeReliefPence = Math.round(config.financeCostReliefRate * Math.min(financeCostsPence, taxableProfitPence));
  const estimatedTaxPence = Math.max(0, taxBeforeReliefPence - financeReliefPence);

  return {
    taxYear,
    appliedTaxYear: config.taxYear,
    income,
    allowableExpenses,
    totalIncomePence,
    totalExpensesPence,
    financeCostsPence,
    financeReliefPence,
    taxableProfitPence,
    taxBand: band,
    estimatedTaxPence,
    boxes: buildBoxes(rows),
  };
}

function buildBoxes(rows: Transaction[]): Sa105Box[] {
  const byBox = new Map<string, { label: string; amount: number }>();
  for (const t of rows) {
    if (!t.category) continue;
    const meta = CATEGORY_META[t.category];
    if (meta.sa105Box === "—") continue; // excluded / capital — not on SA105
    const existing = byBox.get(meta.sa105Box);
    const amount = (existing?.amount ?? 0) + t.amountPence;
    byBox.set(meta.sa105Box, { label: meta.sa105BoxLabel, amount });
  }
  return [...byBox.entries()]
    .map(([box, v]) => ({ box, label: v.label, amountPence: v.amount }))
    .sort((a, b) => Number(a.box) - Number(b.box));
}
