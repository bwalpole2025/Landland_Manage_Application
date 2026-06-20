// ---------------------------------------------------------------------------
// Landland domain model
//
// Conventions:
//  - All money is stored as integer PENCE (GBP). Never use floats for money.
//  - All dates are ISO-8601 date strings ("YYYY-MM-DD") unless noted.
//  - IDs are opaque strings.
// ---------------------------------------------------------------------------

export type ID = string;

/** GBP amount in integer pence. £1,250.00 === 125000. */
export type Pence = number;

// --- Identity & access -----------------------------------------------------

export type Role = "owner" | "member" | "accountant";

export interface User {
  id: ID;
  name: string;
  email: string;
}

/** A user's membership of an account, with a role. Accountants are delegated. */
export interface Membership {
  userId: ID;
  accountId: ID;
  role: Role;
  /** True when this access was granted to an external accountant/assistant. */
  delegated: boolean;
}

export type AccountType = "individual" | "portfolio" | "limited_company";

export interface Account {
  id: ID;
  name: string;
  type: AccountType;
  /** HMRC Making Tax Digital enrolment status for this account. */
  mtd: {
    enrolled: boolean;
    /** National Insurance number or UTR reference (masked in UI). */
    utr?: string;
  };
}

// --- Properties & tenancies -------------------------------------------------

export type PropertyType = "flat" | "terraced" | "semi_detached" | "detached" | "hmo" | "commercial";

export interface Address {
  line1: string;
  line2?: string;
  city: string;
  postcode: string;
}

export interface Property {
  id: ID;
  accountId: ID;
  nickname: string;
  address: Address;
  type: PropertyType;
  bedrooms: number;
  /** Ownership split across users, must sum to 100. Drives P&L apportionment. */
  ownership: { userId: ID; share: number }[];
  purchasePricePence?: Pence;
  purchaseDate?: string;
}

export type TenancyStatus = "active" | "ended" | "vacant";

export interface Tenant {
  id: ID;
  name: string;
  email?: string;
  phone?: string;
}

export interface Tenancy {
  id: ID;
  propertyId: ID;
  status: TenancyStatus;
  tenants: Tenant[];
  startDate: string;
  endDate?: string;
  /** Monthly rent in pence. */
  rentPence: Pence;
  rentFrequency: "monthly" | "weekly";
  /** Day of month rent is due (1–28). */
  rentDueDay: number;
  depositPence?: Pence;
  depositScheme?: "tds" | "dps" | "mydeposits";
}

// --- Money in & out ---------------------------------------------------------

export type TransactionDirection = "income" | "expense";

/**
 * Categories map onto the boxes of HMRC's SA105 UK property pages.
 * See lib/sa105.ts for the box mapping and labels.
 */
export type TransactionCategory =
  // income
  | "rent"
  | "other_property_income"
  // expenses
  | "rent_rates_insurance" // SA105 box 24
  | "repairs_maintenance" // box 25
  | "finance_costs" // box 26 (mortgage interest — relief restricted)
  | "professional_fees" // box 27 (letting agent, legal, accountancy)
  | "services_wages" // box 28
  | "other_expenses"; // box 29

export type ReconcileStatus = "unreconciled" | "reconciled" | "ignored";

export interface Transaction {
  id: ID;
  accountId: ID;
  propertyId?: ID; // unassigned transactions have no property yet
  tenancyId?: ID;
  date: string;
  direction: TransactionDirection;
  amountPence: Pence; // always positive; `direction` gives the sign
  category?: TransactionCategory;
  description: string;
  /** Where this came from. Bank-feed items arrive un-categorised. */
  source: "bank_feed" | "manual";
  reconcile: ReconcileStatus;
  bankAccountId?: ID;
}

// --- Compliance documents ---------------------------------------------------

export type ComplianceDocType =
  | "gas_safety" // CP12, annual
  | "eicr" // electrical, 5-yearly
  | "epc" // energy performance, 10-yearly
  | "insurance"
  | "tenancy_agreement"
  | "right_to_rent"
  | "deposit_protection"
  | "other";

export interface ComplianceDocument {
  id: ID;
  accountId: ID;
  propertyId: ID;
  type: ComplianceDocType;
  title: string;
  /** Stored file reference (mock: a path/URL). */
  fileRef: string;
  issueDate?: string;
  /** Renewal/expiry date that drives reminders. */
  expiryDate?: string;
}

// --- Tax (SA105) ------------------------------------------------------------

export interface Sa105Box {
  box: string; // e.g. "20"
  label: string;
  amountPence: Pence;
}

export interface TaxEstimate {
  taxYear: string; // e.g. "2026/27"
  totalIncomePence: Pence;
  totalExpensesPence: Pence;
  /** Allowable finance costs get basic-rate (20%) relief, not full deduction. */
  financeCostsPence: Pence;
  taxableProfitPence: Pence;
  /** Indicative tax due — an ESTIMATE, not advice. */
  estimatedTaxPence: Pence;
  boxes: Sa105Box[];
}

// --- MTD for IT -------------------------------------------------------------

export type MtdObligationStatus = "open" | "fulfilled" | "overdue";

export interface MtdObligation {
  id: ID;
  taxYear: string;
  /** Quarter label, e.g. "Q1". */
  period: string;
  startDate: string;
  endDate: string;
  dueDate: string;
  status: MtdObligationStatus;
}

export interface MtdSubmission {
  id: ID;
  obligationId: ID;
  submittedAt: string; // ISO datetime
  totalIncomePence: Pence;
  totalExpensesPence: Pence;
  /** Reference returned by HMRC (mock). */
  receiptRef: string;
}

// --- Bank feed --------------------------------------------------------------

export type BankConnectionStatus = "connected" | "disconnected" | "needs_reauth";

export interface BankAccount {
  id: ID;
  accountId: ID;
  bankName: string;
  accountName: string;
  /** Masked, e.g. "•••• 4421". */
  maskedNumber: string;
  status: BankConnectionStatus;
  lastSyncedAt?: string; // ISO datetime
}
