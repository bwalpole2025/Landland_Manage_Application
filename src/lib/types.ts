// ---------------------------------------------------------------------------
// PropManage domain model
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
  /** IANA time zone the account's dates/times are presented in. */
  timeZone: string;
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
  /** Portfolio this property belongs to; unset falls to the default portfolio. */
  portfolioId?: ID;
  /** Ownership split across users, must sum to 100. Drives P&L apportionment. */
  ownership: { userId: ID; share: number }[];
  purchasePricePence?: Pence;
  purchaseDate?: string;
  /** Set when archived — hidden from active lists, but history is preserved. */
  archivedAt?: string;
}

/** A free-text note kept against a property and, optionally, a tenancy. */
export interface PropertyNote {
  id: ID;
  propertyId: ID;
  tenancyId?: ID;
  body: string;
  author: string;
  createdAt: string; // ISO datetime
}

export type ReminderStatus = "open" | "completed";

/** A user task with a due date — surfaces under "My work" and on the calendar. */
export interface Reminder {
  id: ID;
  accountId: ID;
  name: string;
  description?: string;
  dueDate: string; // ISO date
  status: ReminderStatus;
  completedAt?: string; // ISO datetime
  propertyId?: ID;
  tenancyId?: ID;
}

export type PortfolioType = "personal" | "business";

/** A grouping of properties (e.g. personally-held vs through a company). */
export interface Portfolio {
  id: ID;
  accountId: ID;
  name: string;
  type: PortfolioType;
  isDefault?: boolean;
  /** Set when this portfolio is held through a limited company. */
  companyId?: ID;
}

/** A limited company structure, enabling directors'-loan tracking. */
export interface Company {
  id: ID;
  accountId: ID;
  name: string;
  companyNumber?: string;
  incorporationDate?: string;
  /** Outstanding directors' loan balance owed to/by the directors. */
  directorsLoanBalancePence: Pence;
}

/** A single movement on a director's loan account with a company. */
export interface DirectorLoanMovement {
  id: ID;
  companyId: ID;
  /** The director (a User). */
  directorUserId: ID;
  date: string;
  /** advance = director lends to company; repayment = company repays director. */
  direction: "advance" | "repayment";
  amountPence: Pence;
  note?: string;
}

export type InsuranceType = "buildings" | "contents" | "landlord" | "rent_guarantee" | "block";

/** An insurance policy held against a property. */
export interface InsurancePolicy {
  id: ID;
  propertyId: ID;
  type: InsuranceType;
  provider: string;
  policyNumber?: string;
  premiumPence?: Pence;
  startDate?: string;
  /** Renewal/expiry date that drives reminders. */
  expiryDate: string;
}

/** A point-in-time property valuation. The latest one is the "current" value. */
export interface Valuation {
  id: ID;
  propertyId: ID;
  amountPence: Pence;
  date: string; // ISO date of the valuation
  source?: "purchase" | "estimate" | "surveyor" | "avm";
}

/** An outstanding mortgage on a property. */
export interface Mortgage {
  id: ID;
  propertyId: ID;
  lender: string;
  balancePence: Pence;
  monthlyPaymentPence?: Pence;
  interestRateBps?: number; // basis points, 1% = 100
  repaymentType?: "repayment" | "interest_only";
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
  | "rent" // SA105 box 20
  | "deposit" // tenancy deposit held in a scheme — NOT taxable income
  | "other_property_income" // box 20
  // expenses
  | "rent_rates_insurance" // SA105 box 24 (insurance, ground rent, service charges, utilities)
  | "repairs_maintenance" // box 25
  | "finance_costs" // box 44 (mortgage interest — basic-rate relief, not deduction)
  | "professional_fees" // box 27 (letting/management, legal, accountancy)
  | "services_wages" // box 28
  | "other_expenses" // box 29
  | "capital_expense"; // improvements/purchases — capital, tracked separately (CGT), not SA105

export type ReconcileStatus = "unreconciled" | "reconciled" | "ignored";

export interface Transaction {
  id: ID;
  accountId: ID;
  propertyId?: ID; // unassigned transactions fall to the default portfolio
  tenancyId?: ID;
  /** Date the money hit the bank account. */
  date: string;
  /**
   * For rent income, the rent DUE date this payment settles, which may differ
   * from the bank `date` (e.g. rent due on the 1st but paid on the 8th).
   * Rent-collection and arrears matching use this date, falling back to `date`.
   */
  rentDueDate?: string;
  direction: TransactionDirection;
  amountPence: Pence; // always positive; `direction` gives the sign
  category?: TransactionCategory;
  /** Optional finer classification within a category (e.g. "Insurance"). */
  subcategory?: string;
  description: string;
  /** Free-text notes attached to the transaction. */
  notes?: string;
  /** Reference to an attached receipt/invoice document. */
  receiptRef?: string;
  /** Where this came from. Bank-feed items arrive un-categorised. */
  source: "bank_feed" | "manual";
  reconcile: ReconcileStatus;
  /** Excluded from totals and tax when true (still visible behind a toggle). */
  deactivated?: boolean;
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
  /** Fine-grained category id (see lib/documents.ts); defaults from `type`. */
  category?: string;
  /** Optional tenancy this document relates to (e.g. a tenancy agreement). */
  tenancyId?: ID;
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

/** Income presented in SA105 structure. */
export interface Sa105Income {
  rentsReceivedPence: Pence; // box 20
  premiumsPence: Pence; // box 22 (lease premiums)
  otherIncomePence: Pence; // box 20 (other property income)
}

/** An allowable expense category total (excludes finance costs + capital). */
export interface Sa105ExpenseLine {
  category: TransactionCategory;
  label: string;
  sa105Box: string;
  amountPence: Pence;
}

export type TaxBand = "none" | "basic" | "higher" | "additional";

export interface TaxEstimate {
  taxYear: string; // e.g. "2026/27"
  /** Which versioned ruleset produced this (handles future-year fallback). */
  appliedTaxYear: string;
  income: Sa105Income;
  allowableExpenses: Sa105ExpenseLine[];
  totalIncomePence: Pence;
  totalExpensesPence: Pence;
  /** Allowable finance costs get basic-rate (20%) relief, not full deduction. */
  financeCostsPence: Pence;
  /** The basic-rate tax reducer applied for those finance costs. */
  financeReliefPence: Pence;
  taxableProfitPence: Pence;
  /** Highest marginal band the taxable profit reaches. */
  taxBand: TaxBand;
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
  /** Open Banking consent expiry — prompts re-authorisation when near/past. */
  consentExpiresAt?: string; // ISO datetime
  /** Opaque provider connection token (never raw credentials). */
  connectionId?: string;
  /** Provider's account id, used to pull/sync transactions. */
  externalAccountId?: string;
}
