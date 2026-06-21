// ---------------------------------------------------------------------------
// In-memory mock dataset for the Landland scaffold.
//
// This stands in for a database. It is intentionally seeded so the UI exercises
// every state worth designing for:
//   - one property in rent arrears (June rent missing on Station Mews)
//   - compliance docs that are expired / critical / upcoming
//   - recent bank-feed transactions that are unreconciled / uncategorised
//   - MTD obligations for the current tax year + one fulfilled submission
//
// Dates are anchored around the "current" date of 2026-06-20 (tax year 2026/27).
// ---------------------------------------------------------------------------

import type {
  Account,
  BankAccount,
  Company,
  ComplianceDocument,
  DirectorLoanMovement,
  InsurancePolicy,
  Membership,
  Mortgage,
  MtdObligation,
  MtdSubmission,
  Portfolio,
  Property,
  PropertyNote,
  Reminder,
  Tenancy,
  Transaction,
  User,
  Valuation,
} from "@/lib/types";
import { poundsToPence } from "@/lib/money";

export const users: User[] = [
  { id: "u_ben", name: "Benjamin Walpole", email: "bjwalpole1866@gmail.com" },
  { id: "u_sarah", name: "Sarah Walpole", email: "sarah@walpole.example" },
  { id: "u_priya", name: "Priya Anand (Accountant)", email: "priya@anandaccounting.example" },
];

export const account: Account = {
  id: "acc_1",
  name: "Walpole Property Holdings",
  type: "portfolio",
  timeZone: "Europe/London",
  mtd: { enrolled: true, utr: "1234567890" },
};

export const memberships: Membership[] = [
  { userId: "u_ben", accountId: "acc_1", role: "owner", delegated: false },
  { userId: "u_sarah", accountId: "acc_1", role: "member", delegated: false },
  { userId: "u_priya", accountId: "acc_1", role: "accountant", delegated: true },
];

export const companies: Company[] = [
  {
    id: "co_walpole",
    accountId: "acc_1",
    name: "Walpole Lettings Ltd",
    companyNumber: "12345678",
    incorporationDate: "2021-01-15",
    directorsLoanBalancePence: poundsToPence(42000),
  },
];

// Movements on each director's loan account. The running balance (advances less
// repayments) reconciles to the company's directorsLoanBalancePence.
export const directorLoanMovements: DirectorLoanMovement[] = [
  { id: "dl_1", companyId: "co_walpole", directorUserId: "u_ben", date: "2025-06-10", direction: "advance", amountPence: poundsToPence(40000), note: "Deposit funding for Harbourside purchase" },
  { id: "dl_2", companyId: "co_walpole", directorUserId: "u_ben", date: "2025-11-02", direction: "repayment", amountPence: poundsToPence(6000), note: "Partial repayment" },
  { id: "dl_3", companyId: "co_walpole", directorUserId: "u_sarah", date: "2025-07-21", direction: "advance", amountPence: poundsToPence(12000), note: "Refurbishment costs" },
  { id: "dl_4", companyId: "co_walpole", directorUserId: "u_sarah", date: "2026-02-14", direction: "repayment", amountPence: poundsToPence(4000), note: "Dividend offset" },
  { id: "dl_5", companyId: "co_walpole", directorUserId: "u_ben", date: "2026-05-09", direction: "advance", amountPence: poundsToPence(5000), note: "Service charge shortfall" },
  { id: "dl_6", companyId: "co_walpole", directorUserId: "u_sarah", date: "2026-06-03", direction: "repayment", amountPence: poundsToPence(2000), note: "Quarterly repayment" },
];

export const portfolios: Portfolio[] = [
  { id: "pf_personal", accountId: "acc_1", name: "Personal — Default portfolio", type: "personal", isDefault: true },
  { id: "pf_business", accountId: "acc_1", name: "Walpole Lettings Ltd", type: "business", companyId: "co_walpole" },
];

export const properties: Property[] = [
  {
    id: "p_oak",
    accountId: "acc_1",
    nickname: "Oakfield Road",
    address: { line1: "12 Oakfield Road", city: "Bristol", postcode: "BS6 7AA" },
    type: "flat",
    bedrooms: 2,
    portfolioId: "pf_personal",
    ownership: [{ userId: "u_ben", share: 100 }],
    purchasePricePence: poundsToPence(285000),
    purchaseDate: "2019-09-12",
  },
  {
    id: "p_station",
    accountId: "acc_1",
    nickname: "Station Mews",
    address: { line1: "4 Station Mews", city: "Bath", postcode: "BA1 2QR" },
    type: "terraced",
    bedrooms: 3,
    portfolioId: "pf_personal",
    ownership: [
      { userId: "u_ben", share: 50 },
      { userId: "u_sarah", share: 50 },
    ],
    purchasePricePence: poundsToPence(410000),
    purchaseDate: "2021-03-30",
  },
  {
    id: "p_harbour",
    accountId: "acc_1",
    nickname: "Harbourside",
    address: {
      line1: "88 Harbourside Apartments",
      line2: "Canons Way",
      city: "Bristol",
      postcode: "BS1 5XQ",
    },
    type: "flat",
    bedrooms: 1,
    portfolioId: "pf_business",
    ownership: [{ userId: "u_ben", share: 100 }],
    purchasePricePence: poundsToPence(230000),
    purchaseDate: "2023-06-01",
  },
];

// Free-text notes kept against a property.
export const propertyNotes: PropertyNote[] = [
  { id: "note_oak_1", propertyId: "p_oak", body: "Tenant reported a slow-draining bathroom sink — booked PlumbRight for the 24th.", author: "Benjamin Walpole", createdAt: "2026-05-18T09:12:00.000Z" },
  { id: "note_oak_2", propertyId: "p_oak", body: "Buildings insurance renews mid-June — shop around before auto-renewal.", author: "Benjamin Walpole", createdAt: "2026-06-02T16:40:00.000Z" },
  { id: "note_station_1", propertyId: "p_station", tenancyId: "ten_station", body: "June rent late again — chase A Bennett and check the standing order is still set up.", author: "Sarah Walpole", createdAt: "2026-06-12T11:05:00.000Z" },
];

export const reminders: Reminder[] = [
  { id: "rem_gas", accountId: "acc_1", name: "Book gas safety inspection", description: "Oakfield Road CP12 renewal due — arrange an engineer.", dueDate: "2026-07-08", status: "open", propertyId: "p_oak" },
  { id: "rem_arrears", accountId: "acc_1", name: "Chase Station Mews arrears", description: "Aisha Bennett — June rent outstanding.", dueDate: "2026-06-25", status: "open", propertyId: "p_station", tenancyId: "ten_station" },
  { id: "rem_mtd", accountId: "acc_1", name: "File Q4 MTD update", description: "2025/26 final quarter submitted to HMRC.", dueDate: "2026-05-07", status: "completed", completedAt: "2026-05-05T09:30:00.000Z" },
];

// Insurance policies per property (powers the Insurance tab).
export const insurancePolicies: InsurancePolicy[] = [
  { id: "ins_oak", propertyId: "p_oak", type: "landlord", provider: "Aviva", policyNumber: "AV-7741-LB", premiumPence: poundsToPence(320), startDate: "2025-06-16", expiryDate: "2026-06-15" },
  { id: "ins_station", propertyId: "p_station", type: "buildings", provider: "Direct Line", policyNumber: "DL-22918", premiumPence: poundsToPence(415), startDate: "2026-02-01", expiryDate: "2027-02-01" },
  { id: "ins_harbour", propertyId: "p_harbour", type: "block", provider: "Zurich (via freeholder)", policyNumber: "ZB-50431", premiumPence: poundsToPence(0), startDate: "2025-12-20", expiryDate: "2026-12-20" },
];

// Current valuations — all three properties valued above their purchase price
// (shows capital growth in Market Risk). Drives valuation coverage = 3/3.
export const valuations: Valuation[] = [
  { id: "val_oak", propertyId: "p_oak", amountPence: poundsToPence(320000), date: "2026-01-15", source: "estimate" },
  { id: "val_station", propertyId: "p_station", amountPence: poundsToPence(445000), date: "2026-02-02", source: "surveyor" },
  { id: "val_harbour", propertyId: "p_harbour", amountPence: poundsToPence(248000), date: "2026-03-10", source: "avm" },
];

// Mortgages on two of three properties (Harbourside is owned outright), so
// mortgage coverage = 2/3 and the data-completeness indicator is < 100%.
export const mortgages: Mortgage[] = [
  {
    id: "mtg_oak",
    propertyId: "p_oak",
    lender: "Barclays BTL",
    balancePence: poundsToPence(190000),
    monthlyPaymentPence: poundsToPence(410),
    interestRateBps: 489,
    repaymentType: "interest_only",
  },
  {
    id: "mtg_station",
    propertyId: "p_station",
    lender: "NatWest BTL",
    balancePence: poundsToPence(280000),
    monthlyPaymentPence: poundsToPence(640),
    interestRateBps: 512,
    repaymentType: "interest_only",
  },
];

export const tenancies: Tenancy[] = [
  {
    id: "ten_oak",
    propertyId: "p_oak",
    status: "active",
    tenants: [{ id: "tn_james", name: "James Fletcher", email: "james.fletcher@example.com" }],
    startDate: "2024-10-01",
    rentPence: poundsToPence(1250),
    rentFrequency: "monthly",
    rentDueDay: 1,
    depositPence: poundsToPence(1442),
    depositScheme: "tds",
  },
  {
    id: "ten_station",
    propertyId: "p_station",
    status: "active",
    tenants: [
      { id: "tn_aisha", name: "Aisha Bennett", email: "aisha.b@example.com" },
      { id: "tn_tom", name: "Tom Bennett" },
    ],
    startDate: "2023-08-05",
    rentPence: poundsToPence(1600),
    rentFrequency: "monthly",
    rentDueDay: 5,
    depositPence: poundsToPence(1846),
    depositScheme: "dps",
  },
  {
    id: "ten_harbour",
    propertyId: "p_harbour",
    status: "active",
    tenants: [{ id: "tn_maria", name: "Maria Costa", email: "maria.costa@example.com" }],
    startDate: "2025-02-15",
    rentPence: poundsToPence(1100),
    rentFrequency: "monthly",
    rentDueDay: 15,
    depositPence: poundsToPence(1269),
    depositScheme: "mydeposits",
  },
];

export const bankAccounts: BankAccount[] = [
  {
    id: "ba_barclays",
    accountId: "acc_1",
    bankName: "Barclays",
    accountName: "Property Current Account",
    maskedNumber: "•••• 4421",
    status: "connected",
    lastSyncedAt: "2026-06-20T07:45:00.000Z",
    consentExpiresAt: "2026-08-28T00:00:00.000Z", // ~69 days away
    connectionId: "conn_barclays_acc_1",
    externalAccountId: "conn_barclays_acc_1_current",
  },
  {
    id: "ba_starling",
    accountId: "acc_1",
    bankName: "Starling",
    accountName: "Buy-to-Let Pot",
    maskedNumber: "•••• 9087",
    status: "needs_reauth",
    lastSyncedAt: "2026-05-29T06:10:00.000Z",
    consentExpiresAt: "2026-06-10T00:00:00.000Z", // expired — needs reconnection
    connectionId: "conn_starling_acc_1",
    externalAccountId: "conn_starling_acc_1_current",
  },
];

// Helper to keep the transaction list terse.
let txSeq = 0;
function tx(t: Omit<Transaction, "id" | "accountId">): Transaction {
  txSeq += 1;
  return { id: `txn_${String(txSeq).padStart(3, "0")}`, accountId: "acc_1", ...t };
}

export const transactions: Transaction[] = [
  // --- Oakfield Road --- (rent due on the 1st; April landed on the 8th: bank date ≠ due date)
  tx({ propertyId: "p_oak", tenancyId: "ten_oak", date: "2026-04-08", rentDueDate: "2026-04-01", direction: "income", amountPence: poundsToPence(1250), category: "rent", description: "Rent — J Fletcher", source: "bank_feed", reconcile: "reconciled", bankAccountId: "ba_barclays" }),
  tx({ propertyId: "p_oak", tenancyId: "ten_oak", date: "2026-05-01", rentDueDate: "2026-05-01", direction: "income", amountPence: poundsToPence(1250), category: "rent", description: "Rent — J Fletcher", source: "bank_feed", reconcile: "reconciled", bankAccountId: "ba_barclays" }),
  tx({ propertyId: "p_oak", tenancyId: "ten_oak", date: "2026-06-01", rentDueDate: "2026-06-01", direction: "income", amountPence: poundsToPence(1250), category: "rent", description: "Rent — J Fletcher", source: "bank_feed", reconcile: "reconciled", bankAccountId: "ba_barclays" }),
  tx({ propertyId: "p_oak", date: "2026-04-10", direction: "expense", amountPence: poundsToPence(320), category: "rent_rates_insurance", description: "Landlord insurance — annual", source: "manual", reconcile: "reconciled" }),
  tx({ propertyId: "p_oak", date: "2026-04-28", direction: "expense", amountPence: poundsToPence(410), category: "finance_costs", description: "BTL mortgage interest", source: "bank_feed", reconcile: "reconciled", bankAccountId: "ba_barclays" }),
  tx({ propertyId: "p_oak", date: "2026-05-28", direction: "expense", amountPence: poundsToPence(410), category: "finance_costs", description: "BTL mortgage interest", source: "bank_feed", reconcile: "reconciled", bankAccountId: "ba_barclays" }),
  tx({ propertyId: "p_oak", date: "2026-05-20", direction: "expense", amountPence: poundsToPence(186), category: "repairs_maintenance", description: "Boiler service & repair — PlumbRight", source: "bank_feed", reconcile: "reconciled", bankAccountId: "ba_barclays", notes: "Annual service plus thermostat replacement.", receiptRef: "/files/receipts/plumbright-may.pdf" }),

  // --- Station Mews (in arrears: June rent missing) ---
  tx({ propertyId: "p_station", tenancyId: "ten_station", date: "2026-04-06", rentDueDate: "2026-04-05", direction: "income", amountPence: poundsToPence(1600), category: "rent", description: "Rent — A Bennett", source: "bank_feed", reconcile: "reconciled", bankAccountId: "ba_barclays" }),
  tx({ propertyId: "p_station", tenancyId: "ten_station", date: "2026-05-05", rentDueDate: "2026-05-05", direction: "income", amountPence: poundsToPence(1600), category: "rent", description: "Rent — A Bennett", source: "bank_feed", reconcile: "reconciled", bankAccountId: "ba_barclays" }),
  // NOTE: no June rent for Station Mews — this drives the arrears alert.
  tx({ propertyId: "p_station", date: "2026-04-06", direction: "expense", amountPence: poundsToPence(192), category: "professional_fees", description: "Letting agent management fee", source: "bank_feed", reconcile: "reconciled", bankAccountId: "ba_barclays" }),
  tx({ propertyId: "p_station", date: "2026-05-05", direction: "expense", amountPence: poundsToPence(192), category: "professional_fees", description: "Letting agent management fee", source: "bank_feed", reconcile: "reconciled", bankAccountId: "ba_barclays" }),
  tx({ propertyId: "p_station", date: "2026-04-28", direction: "expense", amountPence: poundsToPence(640), category: "finance_costs", description: "BTL mortgage interest", source: "bank_feed", reconcile: "reconciled", bankAccountId: "ba_barclays" }),
  tx({ propertyId: "p_station", date: "2026-05-28", direction: "expense", amountPence: poundsToPence(640), category: "finance_costs", description: "BTL mortgage interest", source: "bank_feed", reconcile: "reconciled", bankAccountId: "ba_barclays" }),

  // --- Harbourside ---
  tx({ propertyId: "p_harbour", tenancyId: "ten_harbour", date: "2026-04-15", rentDueDate: "2026-04-15", direction: "income", amountPence: poundsToPence(1100), category: "rent", description: "Rent — M Costa", source: "bank_feed", reconcile: "reconciled", bankAccountId: "ba_barclays" }),
  tx({ propertyId: "p_harbour", tenancyId: "ten_harbour", date: "2026-05-15", rentDueDate: "2026-05-15", direction: "income", amountPence: poundsToPence(1100), category: "rent", description: "Rent — M Costa", source: "bank_feed", reconcile: "reconciled", bankAccountId: "ba_barclays" }),
  tx({ propertyId: "p_harbour", date: "2026-04-20", direction: "expense", amountPence: poundsToPence(95), category: "rent_rates_insurance", description: "Service charge & ground rent", source: "manual", reconcile: "reconciled" }),

  // --- Recent bank-feed items needing attention (unreconciled / uncategorised) ---
  tx({ propertyId: "p_harbour", tenancyId: "ten_harbour", date: "2026-06-15", rentDueDate: "2026-06-15", direction: "income", amountPence: poundsToPence(1100), category: "rent", description: "Rent — M Costa", source: "bank_feed", reconcile: "unreconciled", bankAccountId: "ba_barclays" }),
  // Station Mews June rent HAS arrived, but is un-categorised/unlinked — so the
  // arrears alert still fires until the user categorises it as rent + links the
  // tenancy. The payee "BENNETT" lets the rules engine auto-suggest the match.
  tx({ date: "2026-06-08", direction: "income", amountPence: poundsToPence(1600), description: "FASTER PAYMENT A BENNETT", source: "bank_feed", reconcile: "unreconciled", bankAccountId: "ba_barclays" }),
  tx({ date: "2026-06-18", direction: "expense", amountPence: poundsToPence(48), description: "SCREWFIX BRISTOL", source: "bank_feed", reconcile: "unreconciled", bankAccountId: "ba_barclays" }),
  tx({ propertyId: "p_oak", date: "2026-06-19", direction: "expense", amountPence: poundsToPence(75), category: "professional_fees", description: "Accountancy fee — monthly", source: "bank_feed", reconcile: "unreconciled", bankAccountId: "ba_barclays" }),
  // A duplicate bank import, deactivated so it doesn't double-count (hidden
  // unless "show deactivated" is on).
  tx({ propertyId: "p_oak", tenancyId: "ten_oak", date: "2026-05-02", rentDueDate: "2026-05-01", direction: "income", amountPence: poundsToPence(1250), category: "rent", description: "Rent — J Fletcher (duplicate)", source: "bank_feed", reconcile: "ignored", deactivated: true, bankAccountId: "ba_barclays" }),
];

export const complianceDocuments: ComplianceDocument[] = [
  // Expired — needs immediate attention.
  { id: "doc_oak_ins", accountId: "acc_1", propertyId: "p_oak", type: "insurance", title: "Landlord buildings insurance", fileRef: "/files/oak-insurance-2025.pdf", issueDate: "2025-06-16", expiryDate: "2026-06-15" },
  // Critical (<= 7 days).
  { id: "doc_station_eicr", accountId: "acc_1", propertyId: "p_station", type: "eicr", title: "EICR — electrical safety", fileRef: "/files/station-eicr.pdf", issueDate: "2021-06-25", expiryDate: "2026-06-25" },
  { id: "doc_harbour_epc", accountId: "acc_1", propertyId: "p_harbour", type: "epc", title: "EPC — rating C", fileRef: "/files/harbour-epc.pdf", issueDate: "2016-06-21", expiryDate: "2026-06-21" },
  // Upcoming (<= 30 days).
  { id: "doc_oak_gas", accountId: "acc_1", propertyId: "p_oak", type: "gas_safety", title: "Gas safety certificate (CP12)", fileRef: "/files/oak-gas-2025.pdf", issueDate: "2025-07-10", expiryDate: "2026-07-10" },
  // Healthy.
  { id: "doc_oak_epc", accountId: "acc_1", propertyId: "p_oak", type: "epc", title: "EPC — rating B", fileRef: "/files/oak-epc.pdf", issueDate: "2021-03-01", expiryDate: "2031-03-01" },
  { id: "doc_station_gas", accountId: "acc_1", propertyId: "p_station", type: "gas_safety", title: "Gas safety certificate (CP12)", fileRef: "/files/station-gas.pdf", issueDate: "2025-12-01", expiryDate: "2026-12-01" },
  { id: "doc_harbour_gas", accountId: "acc_1", propertyId: "p_harbour", type: "gas_safety", title: "Gas safety certificate (CP12)", fileRef: "/files/harbour-gas.pdf", issueDate: "2026-02-14", expiryDate: "2027-02-14" },
  { id: "doc_station_ten", accountId: "acc_1", propertyId: "p_station", type: "tenancy_agreement", title: "Assured shorthold tenancy agreement", fileRef: "/files/station-ast.pdf", issueDate: "2023-08-05" },
];

export const mtdObligations: MtdObligation[] = [
  // Prior-year final quarter — already submitted (history).
  { id: "ob_2526_q4", taxYear: "2025/26", period: "Q4", startDate: "2026-01-06", endDate: "2026-04-05", dueDate: "2026-05-07", status: "fulfilled" },
  // Current tax year 2026/27.
  { id: "ob_2627_q1", taxYear: "2026/27", period: "Q1", startDate: "2026-04-06", endDate: "2026-07-05", dueDate: "2026-08-07", status: "open" },
  { id: "ob_2627_q2", taxYear: "2026/27", period: "Q2", startDate: "2026-07-06", endDate: "2026-10-05", dueDate: "2026-11-07", status: "open" },
  { id: "ob_2627_q3", taxYear: "2026/27", period: "Q3", startDate: "2026-10-06", endDate: "2027-01-05", dueDate: "2027-02-07", status: "open" },
  { id: "ob_2627_q4", taxYear: "2026/27", period: "Q4", startDate: "2027-01-06", endDate: "2027-04-05", dueDate: "2027-05-07", status: "open" },
];

export const mtdSubmissions: MtdSubmission[] = [
  {
    id: "sub_2526_q4",
    obligationId: "ob_2526_q4",
    submittedAt: "2026-04-22T10:14:00.000Z",
    totalIncomePence: poundsToPence(11700),
    totalExpensesPence: poundsToPence(4380),
    receiptRef: "HMRC-MTD-2526Q4-8F3A21",
  },
];

/** The currently "signed in" user for the mock session. */
export const CURRENT_USER_ID = "u_ben";
