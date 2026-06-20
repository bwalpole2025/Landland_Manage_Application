// Mapping of Landland transaction categories onto HMRC's SA105 "UK property"
// self-assessment pages. This is a simplified residential-property model used
// for the in-app tax ESTIMATE — it is not tax advice.

import type { TransactionCategory } from "./types";

export interface CategoryMeta {
  label: string;
  direction: "income" | "expense";
  /** SA105 box number this category aggregates into. */
  sa105Box: string;
  sa105BoxLabel: string;
  /**
   * Finance costs (e.g. mortgage interest) are not a normal deduction; they
   * attract basic-rate (20%) relief via box 44. Flag them so the tax engine
   * handles them separately.
   */
  isFinanceCost?: boolean;
}

export const CATEGORY_META: Record<TransactionCategory, CategoryMeta> = {
  rent: {
    label: "Rent received",
    direction: "income",
    sa105Box: "20",
    sa105BoxLabel: "Total rents and other income from property",
  },
  other_property_income: {
    label: "Other property income",
    direction: "income",
    sa105Box: "20",
    sa105BoxLabel: "Total rents and other income from property",
  },
  rent_rates_insurance: {
    label: "Rent, rates, insurance, ground rents",
    direction: "expense",
    sa105Box: "24",
    sa105BoxLabel: "Rent, rates, insurance, ground rents",
  },
  repairs_maintenance: {
    label: "Property repairs and maintenance",
    direction: "expense",
    sa105Box: "25",
    sa105BoxLabel: "Property repairs and maintenance",
  },
  finance_costs: {
    label: "Loan interest & other finance costs",
    direction: "expense",
    sa105Box: "44",
    sa105BoxLabel: "Residential finance costs (basic-rate relief)",
    isFinanceCost: true,
  },
  professional_fees: {
    label: "Legal, management & professional fees",
    direction: "expense",
    sa105Box: "27",
    sa105BoxLabel: "Legal, management and other professional fees",
  },
  services_wages: {
    label: "Services & wages",
    direction: "expense",
    sa105Box: "28",
    sa105BoxLabel: "Costs of services provided, including wages",
  },
  other_expenses: {
    label: "Other allowable expenses",
    direction: "expense",
    sa105Box: "29",
    sa105BoxLabel: "Other allowable property expenses",
  },
};

export function categoryLabel(category: TransactionCategory | undefined): string {
  if (!category) return "Uncategorised";
  return CATEGORY_META[category].label;
}

export const TAX_DISCLAIMER =
  "Figures shown are an automated estimate based on your records and current-year " +
  "rules. They are not tax advice. Always confirm with a qualified accountant before filing.";
