// Mapping of PropManage transaction categories onto HMRC's SA105 "UK property"
// self-assessment pages. This is a simplified residential-property model used
// for the in-app tax ESTIMATE — it is not tax advice.

import type { TransactionCategory } from "./types";

/**
 * How a category is treated in the SA105 tax estimate:
 *  - income            → taxable property income (box 20)
 *  - allowable_expense → deducted from income
 *  - finance_cost      → basic-rate (20%) relief, not a deduction (box 44)
 *  - excluded          → ignored entirely (e.g. tenancy deposits held in a scheme)
 *  - capital           → capital, not a revenue expense; tracked for CGT, not SA105
 */
export type TaxTreatment = "income" | "allowable_expense" | "finance_cost" | "excluded" | "capital";

export interface CategoryMeta {
  label: string;
  direction: "income" | "expense";
  treatment: TaxTreatment;
  /** SA105 box number this category aggregates into ("—" when not on SA105). */
  sa105Box: string;
  sa105BoxLabel: string;
  /** @deprecated use `treatment === "finance_cost"`. Kept for back-compat. */
  isFinanceCost?: boolean;
}

export const CATEGORY_META: Record<TransactionCategory, CategoryMeta> = {
  rent: {
    label: "Rent received",
    direction: "income",
    treatment: "income",
    sa105Box: "20",
    sa105BoxLabel: "Total rents and other income from property",
  },
  deposit: {
    label: "Tenancy deposit",
    direction: "income",
    treatment: "excluded",
    sa105Box: "—",
    sa105BoxLabel: "Deposit held in a protection scheme (not taxable income)",
  },
  other_property_income: {
    label: "Other property income",
    direction: "income",
    treatment: "income",
    sa105Box: "20",
    sa105BoxLabel: "Total rents and other income from property",
  },
  rent_rates_insurance: {
    label: "Rent, rates, insurance, ground rents",
    direction: "expense",
    treatment: "allowable_expense",
    sa105Box: "24",
    sa105BoxLabel: "Rent, rates, insurance, ground rents",
  },
  repairs_maintenance: {
    label: "Property repairs and maintenance",
    direction: "expense",
    treatment: "allowable_expense",
    sa105Box: "25",
    sa105BoxLabel: "Property repairs and maintenance",
  },
  finance_costs: {
    label: "Loan interest & other finance costs",
    direction: "expense",
    treatment: "finance_cost",
    sa105Box: "44",
    sa105BoxLabel: "Residential finance costs (basic-rate relief)",
    isFinanceCost: true,
  },
  professional_fees: {
    label: "Legal, management & professional fees",
    direction: "expense",
    treatment: "allowable_expense",
    sa105Box: "27",
    sa105BoxLabel: "Legal, management and other professional fees",
  },
  services_wages: {
    label: "Services & wages",
    direction: "expense",
    treatment: "allowable_expense",
    sa105Box: "28",
    sa105BoxLabel: "Costs of services provided, including wages",
  },
  other_expenses: {
    label: "Other allowable expenses",
    direction: "expense",
    treatment: "allowable_expense",
    sa105Box: "29",
    sa105BoxLabel: "Other allowable property expenses",
  },
  capital_expense: {
    label: "Capital expense",
    direction: "expense",
    treatment: "capital",
    sa105Box: "—",
    sa105BoxLabel: "Capital expenditure (improvements) — relevant to CGT, not SA105",
  },
};

export function categoryLabel(category: TransactionCategory | undefined): string {
  if (!category) return "Uncategorised";
  return CATEGORY_META[category].label;
}

export const TAX_DISCLAIMER =
  "Figures shown are an automated estimate based on your records and current-year " +
  "rules. They are not tax advice. Always confirm with a qualified accountant before filing.";
