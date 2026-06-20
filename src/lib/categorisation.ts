// Landlord-facing categorisation: a friendly category picker that maps cleanly
// onto the SA105 box-level `TransactionCategory`, plus a small rules engine that
// auto-suggests a category + property/tenancy from a payee/description + amount.

import type { Pence, Transaction, TransactionCategory, TransactionDirection } from "./types";

export interface CategoryOption {
  /** Stable key used by the picker and rules engine. */
  value: string;
  label: string;
  direction: TransactionDirection;
  category: TransactionCategory;
  /** Optional finer classification stored on the transaction. */
  subcategory?: string;
}

// The landlord-facing list. Several options share one SA105 category (e.g.
// insurance, ground rent and utilities all sit in box 24) but carry a distinct
// subcategory so the user picks the term they expect.
export const CATEGORY_OPTIONS: CategoryOption[] = [
  // Income
  { value: "rent", label: "Rent received", direction: "income", category: "rent" },
  { value: "deposit", label: "Tenancy deposit", direction: "income", category: "deposit" },
  { value: "other_income", label: "Other property income", direction: "income", category: "other_property_income" },
  // Expenses
  { value: "repairs_maintenance", label: "Repairs & maintenance", direction: "expense", category: "repairs_maintenance" },
  { value: "letting_management", label: "Letting & management fees", direction: "expense", category: "professional_fees", subcategory: "Letting & management fees" },
  { value: "legal_professional", label: "Legal & professional fees", direction: "expense", category: "professional_fees", subcategory: "Legal & professional fees" },
  { value: "insurance", label: "Insurance", direction: "expense", category: "rent_rates_insurance", subcategory: "Insurance" },
  { value: "ground_rent_service", label: "Ground rent & service charges", direction: "expense", category: "rent_rates_insurance", subcategory: "Ground rent & service charges" },
  { value: "utilities", label: "Utilities & council tax", direction: "expense", category: "rent_rates_insurance", subcategory: "Utilities & council tax" },
  { value: "services_wages", label: "Services & wages", direction: "expense", category: "services_wages" },
  { value: "mortgage_interest", label: "Mortgage interest (finance cost)", direction: "expense", category: "finance_costs", subcategory: "Mortgage interest" },
  { value: "capital_expense", label: "Capital expense (improvement)", direction: "expense", category: "capital_expense" },
  { value: "other_expenses", label: "Other allowable expenses", direction: "expense", category: "other_expenses" },
];

const BY_VALUE = new Map(CATEGORY_OPTIONS.map((o) => [o.value, o]));

export function optionsForDirection(direction: TransactionDirection): CategoryOption[] {
  return CATEGORY_OPTIONS.filter((o) => o.direction === direction);
}

export function resolveOption(value: string): CategoryOption | undefined {
  return BY_VALUE.get(value);
}

/** The picker value that best represents a transaction's category + subcategory. */
export function optionValueFor(t: Pick<Transaction, "category" | "subcategory">): string {
  if (!t.category) return "";
  const exact = CATEGORY_OPTIONS.find((o) => o.category === t.category && (o.subcategory ?? "") === (t.subcategory ?? ""));
  if (exact) return exact.value;
  return CATEGORY_OPTIONS.find((o) => o.category === t.category)?.value ?? "";
}

// --- Rules engine ------------------------------------------------------------

export interface SuggestProperty {
  id: string;
  nickname: string;
}
export interface SuggestTenancy {
  id: string;
  propertyId: string;
  tenantNames: string[];
  rentPence: Pence;
}
export interface SuggestContext {
  properties: SuggestProperty[];
  tenancies: SuggestTenancy[];
}

export interface Suggestion {
  optionValue: string;
  category: TransactionCategory;
  subcategory?: string;
  propertyId?: string;
  tenancyId?: string;
  reason: string;
}

interface ExpenseRule {
  test: RegExp;
  value: string;
}

// Ordered expense rules — first match wins.
const EXPENSE_RULES: ExpenseRule[] = [
  { test: /screwfix|b&q|wickes|toolstation|plumb|electric|boiler|leak|repair|handyman|maintenance|paint/i, value: "repairs_maintenance" },
  { test: /insurance|insure/i, value: "insurance" },
  { test: /mortgage|interest|\bbtl\b|loan/i, value: "mortgage_interest" },
  { test: /letting|lettings|management|managing agent|\bagent\b/i, value: "letting_management" },
  { test: /accountanc|account fee|solicitor|legal|conveyanc|surveyor/i, value: "legal_professional" },
  { test: /council tax|water|sewerage|\bgas\b|energy|utility|utilities|edf|octopus|british gas|eon|ovo/i, value: "utilities" },
  { test: /service charge|ground rent|freehold|estate charge/i, value: "ground_rent_service" },
  { test: /new kitchen|extension|renovation|refurb|capital|improvement/i, value: "capital_expense" },
];

function tokens(s: string): string[] {
  return s.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length >= 3);
}

/** Match a description to a property by nickname/city tokens. */
function matchProperty(description: string, properties: SuggestProperty[]): SuggestProperty | undefined {
  const desc = description.toLowerCase();
  return properties.find((p) => tokens(p.nickname).some((t) => desc.includes(t)));
}

/**
 * Propose a category and, where possible, a property/tenancy. Returns null when
 * nothing confident can be inferred (the user then picks manually).
 */
export function suggestCategorisation(
  tx: Pick<Transaction, "description" | "amountPence" | "direction">,
  ctx: SuggestContext,
): Suggestion | null {
  const make = (value: string, propertyId?: string, tenancyId?: string, reason = ""): Suggestion => {
    const opt = resolveOption(value)!;
    return { optionValue: value, category: opt.category, subcategory: opt.subcategory, propertyId, tenancyId, reason };
  };

  if (tx.direction === "income") {
    // 1) Payee matches a tenant name → rent, linked to that tenancy/property.
    const desc = tx.description.toLowerCase();
    const byTenant = ctx.tenancies.find((t) =>
      t.tenantNames.some((name) => tokens(name).some((tok) => desc.includes(tok))),
    );
    if (byTenant) {
      return make("rent", byTenant.propertyId, byTenant.id, `Matches tenant on ${nameOf(ctx, byTenant.propertyId)}`);
    }
    // 2) Amount matches a tenancy's rent exactly → rent.
    const byAmount = ctx.tenancies.find((t) => t.rentPence === tx.amountPence);
    if (byAmount) {
      return make("rent", byAmount.propertyId, byAmount.id, "Amount matches the monthly rent");
    }
    // 3) Looks like a deposit.
    if (/deposit/i.test(tx.description)) return make("deposit", undefined, undefined, "Looks like a deposit");
    return make("other_income", matchProperty(tx.description, ctx.properties)?.id, undefined, "Other property income");
  }

  // Expense rules.
  const rule = EXPENSE_RULES.find((r) => r.test.test(tx.description));
  const property = matchProperty(tx.description, ctx.properties);
  if (rule) {
    return make(rule.value, property?.id, undefined, `Description looks like ${resolveOption(rule.value)!.label.toLowerCase()}`);
  }
  return make("other_expenses", property?.id, undefined, "Other allowable expense");
}

function nameOf(ctx: SuggestContext, propertyId: string): string {
  return ctx.properties.find((p) => p.id === propertyId)?.nickname ?? "this property";
}
