import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

// Demo credentials (printed at the end so they're easy to find).
const DEMO_EMAIL = "demo@landland.app";
const DEMO_PASSWORD = "Password123!";

const ACCOUNT_ID = "acc_demo";

async function main() {
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 12);
  const now = new Date();

  // --- Account (top-level tenant) ---
  await prisma.account.upsert({
    where: { id: ACCOUNT_ID },
    update: {
      subscriptionStatus: "TRIALING",
      trialEndsAt: new Date("2026-07-04T00:00:00Z"),
      // Clean trial state (no scheduled billing / card on file).
      billingStartsAt: null,
      paymentMethodBrand: null,
      paymentMethodLast4: null,
      billingCustomerId: null,
      billingSubscriptionId: null,
      termsAcceptedAt: null,
    },
    create: {
      id: ACCOUNT_ID,
      name: "Walpole Property Holdings",
      type: "PORTFOLIO",
      // On a free trial → drives the global trial banner ("N days left").
      subscriptionStatus: "TRIALING",
      trialEndsAt: new Date("2026-07-04T00:00:00Z"),
      firstTaxYear: "2024/25",
      timeZone: "Europe/London",
      currency: "GBP",
      mtdEnrolled: true,
      utr: "1234567890",
    },
  });

  // --- Users ---
  const owner = await prisma.user.upsert({
    where: { email: DEMO_EMAIL },
    update: { firstName: "Benjamin", lastName: "Walpole", passwordHash, emailVerified: now, role: "OWNER", numberOfPropertiesManaged: 3 },
    create: { id: "user_demo", accountId: ACCOUNT_ID, email: DEMO_EMAIL, firstName: "Benjamin", lastName: "Walpole", passwordHash, emailVerified: now, role: "OWNER", numberOfPropertiesManaged: 3 },
  });
  const assistant = await prisma.user.upsert({
    where: { email: "sarah@walpole.example" },
    update: {},
    create: { id: "user_sarah", accountId: ACCOUNT_ID, email: "sarah@walpole.example", firstName: "Sarah", lastName: "Walpole", passwordHash, emailVerified: now, role: "ASSISTANT" },
  });
  const accountant = await prisma.user.upsert({
    where: { email: "priya@anandaccounting.example" },
    update: {},
    create: { id: "user_priya", accountId: ACCOUNT_ID, email: "priya@anandaccounting.example", firstName: "Priya", lastName: "Anand", passwordHash, emailVerified: now, role: "ACCOUNTANT" },
  });

  for (const [user, role, delegated] of [
    [owner, "OWNER", false],
    [assistant, "ASSISTANT", false],
    [accountant, "ACCOUNTANT", true],
  ] as const) {
    await prisma.membership.upsert({
      where: { userId_accountId: { userId: user.id, accountId: ACCOUNT_ID } },
      update: { role, delegated },
      create: { userId: user.id, accountId: ACCOUNT_ID, role, delegated },
    });
  }

  // --- Dedicated E2E account: verified + ACTIVE subscription (ungated) so the
  // automated happy-path test runs without the trial gate. Page data is read
  // from the shared mock dataset, so this account only needs to exist + be
  // entitled + verified.
  const e2eAccount = await prisma.account.upsert({
    where: { id: "acc_e2e" },
    update: { subscriptionStatus: "ACTIVE", trialEndsAt: null },
    create: { id: "acc_e2e", name: "E2E Test Account", type: "INDIVIDUAL", subscriptionStatus: "ACTIVE", timeZone: "Europe/London" },
  });
  const e2eUser = await prisma.user.upsert({
    where: { email: "e2e@landland.app" },
    update: { passwordHash, emailVerified: now, role: "OWNER" },
    create: { id: "user_e2e", accountId: e2eAccount.id, email: "e2e@landland.app", firstName: "E2E", lastName: "Runner", passwordHash, emailVerified: now, role: "OWNER" },
  });
  await prisma.membership.upsert({
    where: { userId_accountId: { userId: e2eUser.id, accountId: e2eAccount.id } },
    update: { role: "OWNER" },
    create: { userId: e2eUser.id, accountId: e2eAccount.id, role: "OWNER" },
  });
  await prisma.portfolio.upsert({
    where: { id: "pf_e2e" },
    update: {},
    create: { id: "pf_e2e", accountId: e2eAccount.id, name: "Personal — Default", type: "PERSONAL", isDefault: true },
  });

  // --- Reset account-scoped data for idempotency (FK-safe order) ---
  await prisma.reminder.deleteMany({ where: { accountId: ACCOUNT_ID } });
  await prisma.note.deleteMany({ where: { accountId: ACCOUNT_ID } });
  await prisma.transaction.deleteMany({ where: { accountId: ACCOUNT_ID } });
  await prisma.taxStatement.deleteMany({ where: { accountId: ACCOUNT_ID } });
  await prisma.mortgage.deleteMany({ where: { accountId: ACCOUNT_ID } });
  await prisma.valuation.deleteMany({ where: { accountId: ACCOUNT_ID } });
  await prisma.property.deleteMany({ where: { accountId: ACCOUNT_ID } }); // cascades tenancies/tenants/docs
  await prisma.beneficialOwner.deleteMany({ where: { accountId: ACCOUNT_ID } });
  await prisma.portfolio.deleteMany({ where: { accountId: ACCOUNT_ID } });
  await prisma.company.deleteMany({ where: { accountId: ACCOUNT_ID } });
  await prisma.bankAccount.deleteMany({ where: { accountId: ACCOUNT_ID } });
  await prisma.mtdObligation.deleteMany({ where: { accountId: ACCOUNT_ID } });

  // --- Portfolios + company ---
  const personal = await prisma.portfolio.create({
    data: { accountId: ACCOUNT_ID, name: "Personal — Default", type: "PERSONAL", isDefault: true },
  });
  const company = await prisma.company.create({
    data: { accountId: ACCOUNT_ID, name: "Walpole Lettings Ltd", companyNumber: "09876543", incorporationDate: new Date("2021-02-01"), directorsLoanBalanceMinor: 1_500_000 },
  });
  const business = await prisma.portfolio.create({
    data: { accountId: ACCOUNT_ID, name: "Walpole Lettings Ltd", type: "BUSINESS", isDefault: false, companyId: company.id },
  });

  // --- Beneficial owners ---
  const boBen = await prisma.beneficialOwner.create({
    data: { accountId: ACCOUNT_ID, ownerType: "INDIVIDUAL", name: "Benjamin Walpole", userId: owner.id, portfolioId: personal.id },
  });
  const boSarah = await prisma.beneficialOwner.create({
    data: { accountId: ACCOUNT_ID, ownerType: "INDIVIDUAL", name: "Sarah Walpole", userId: assistant.id, portfolioId: business.id },
  });

  // --- Bank account ---
  const bank = await prisma.bankAccount.create({
    data: { accountId: ACCOUNT_ID, provider: "mock", bankName: "Barclays", accountName: "Property Current Account", maskedNumber: "•••• 4421", status: "CONNECTED", lastSyncedAt: new Date("2026-06-20T07:45:00Z"), consentExpiresAt: new Date("2026-08-28T00:00:00Z") },
  });

  // A second feed needing re-authorisation → drives a bank-feed notification.
  await prisma.bankAccount.create({
    data: { accountId: ACCOUNT_ID, provider: "mock", bankName: "Starling", accountName: "Buy-to-Let Pot", maskedNumber: "•••• 9087", status: "NEEDS_REAUTH", lastSyncedAt: new Date("2026-05-29T06:10:00Z"), consentExpiresAt: new Date("2026-06-10T00:00:00Z") },
  });

  // --- Property 1: Oakfield Road (personal, up to date) ---
  const oak = await prisma.property.create({
    data: {
      accountId: ACCOUNT_ID,
      portfolioId: personal.id,
      nickname: "Oakfield Road",
      line1: "12 Oakfield Road",
      city: "Bristol",
      postcode: "BS6 7AA",
      type: "FLAT",
      bedrooms: 2,
      rentalIncomeMinor: 125_000,
      rentalIncomeFrequency: "MONTHLY",
      currentValuationMinor: 33_000_000,
      purchasePriceMinor: 28_500_000,
      purchaseDate: new Date("2019-09-12"),
      streetViewLat: 51.4669,
      streetViewLng: -2.6045,
      streetViewHeading: 120,
      streetViewPitch: 0,
      streetViewZoom: 1,
      epcRating: "B",
      epcScore: 82,
      epcExpiryDate: new Date("2031-03-01"),
      owners: { create: [{ accountId: ACCOUNT_ID, beneficialOwnerId: boBen.id, ownershipPercentage: 100 }] },
      tenancies: {
        create: {
          accountId: ACCOUNT_ID,
          status: "ACTIVE",
          tenantName: "James Fletcher",
          tenantEmail: "james.fletcher@example.com",
          rentMinor: 125_000,
          rentDueDay: 1,
          depositMinor: 144_200,
          depositScheme: "tds",
          startDate: new Date("2024-10-01"),
          nextPaymentDate: new Date("2026-07-01"),
          balanceState: "UP_TO_DATE",
          tenants: { create: { accountId: ACCOUNT_ID, name: "James Fletcher", email: "james.fletcher@example.com" } },
        },
      },
      documents: {
        create: [
          { accountId: ACCOUNT_ID, category: "GAS_SAFETY", title: "Gas safety certificate (CP12)", storageKey: "docs/oak-gas-2025.pdf", issueDate: new Date("2025-07-10"), expiryDate: new Date("2026-07-10") },
          { accountId: ACCOUNT_ID, category: "INSURANCE", title: "Landlord buildings insurance", storageKey: "docs/oak-insurance-2025.pdf", issueDate: new Date("2025-06-16"), expiryDate: new Date("2026-06-15") },
        ],
      },
    },
    include: { tenancies: true },
  });

  // --- Property 2: Station Mews (business, in arrears) ---
  const station = await prisma.property.create({
    data: {
      accountId: ACCOUNT_ID,
      portfolioId: business.id,
      nickname: "Station Mews",
      line1: "4 Station Mews",
      city: "Bath",
      postcode: "BA1 2QR",
      type: "TERRACED",
      bedrooms: 3,
      rentalIncomeMinor: 160_000,
      rentalIncomeFrequency: "MONTHLY",
      currentValuationMinor: 47_000_000,
      purchasePriceMinor: 41_000_000,
      purchaseDate: new Date("2021-03-30"),
      epcRating: "C",
      epcScore: 72,
      epcExpiryDate: new Date("2026-06-25"),
      owners: {
        create: [
          { accountId: ACCOUNT_ID, beneficialOwnerId: boBen.id, ownershipPercentage: 60 },
          { accountId: ACCOUNT_ID, beneficialOwnerId: boSarah.id, ownershipPercentage: 40 },
        ],
      },
      tenancies: {
        create: {
          accountId: ACCOUNT_ID,
          status: "ACTIVE",
          tenantName: "Aisha Bennett",
          tenantEmail: "aisha.b@example.com",
          rentMinor: 160_000,
          rentDueDay: 5,
          depositMinor: 184_600,
          depositScheme: "dps",
          startDate: new Date("2023-08-05"),
          nextPaymentDate: new Date("2026-07-05"),
          // One month of rent outstanding.
          balanceState: "IN_ARREARS",
          balanceMinor: 160_000,
          tenants: { create: { accountId: ACCOUNT_ID, name: "Aisha Bennett", email: "aisha.b@example.com" } },
        },
      },
      documents: {
        create: [{ accountId: ACCOUNT_ID, category: "EICR", title: "EICR — electrical safety", storageKey: "docs/station-eicr.pdf", issueDate: new Date("2021-06-25"), expiryDate: new Date("2026-06-25") }],
      },
    },
    include: { tenancies: true },
  });

  // --- Property 3: Harbourside (personal) — ACCEPTANCE: £500/mo ongoing tenancy ---
  const harbour = await prisma.property.create({
    data: {
      accountId: ACCOUNT_ID,
      portfolioId: personal.id,
      nickname: "Harbourside",
      line1: "88 Harbourside Apartments",
      line2: "Canons Way",
      city: "Bristol",
      postcode: "BS1 5XQ",
      type: "FLAT",
      bedrooms: 1,
      rentalIncomeMinor: 50_000,
      rentalIncomeFrequency: "MONTHLY",
      currentValuationMinor: 23_000_000,
      purchasePriceMinor: 21_000_000,
      purchaseDate: new Date("2023-06-01"),
      epcRating: "C",
      epcScore: 69,
      epcExpiryDate: new Date("2027-02-14"),
      owners: { create: [{ accountId: ACCOUNT_ID, beneficialOwnerId: boBen.id, ownershipPercentage: 100 }] },
      tenancies: {
        create: {
          accountId: ACCOUNT_ID,
          status: "ACTIVE",
          tenantName: "Maria Costa",
          tenantEmail: "maria.costa@example.com",
          rentMinor: 50_000, // £500
          rentFrequency: "MONTHLY",
          rentDueDay: 15,
          depositMinor: 57_600,
          depositScheme: "mydeposits",
          startDate: new Date("2025-02-15"),
          endDate: null, // ongoing
          nextPaymentDate: new Date("2026-07-15"),
          balanceState: "UP_TO_DATE",
          tenants: { create: { accountId: ACCOUNT_ID, name: "Maria Costa", email: "maria.costa@example.com" } },
        },
      },
    },
    include: { tenancies: true },
  });

  const oakTenancy = oak.tenancies[0];
  const stationTenancy = station.tenancies[0];
  const harbourTenancy = harbour.tenancies[0];

  // --- Mortgages (support loan-to-value) ---
  await prisma.mortgage.createMany({
    data: [
      { accountId: ACCOUNT_ID, propertyId: oak.id, lender: "Nationwide", balanceMinor: 18_000_000, monthlyPaymentMinor: 41_000, interestRateBps: 525, monthlyInterestMinor: 41_000, repaymentType: "INTEREST_ONLY", productName: "2-year fixed", productEndDate: new Date("2027-02-28") },
      { accountId: ACCOUNT_ID, propertyId: station.id, lender: "Halifax", balanceMinor: 25_000_000, monthlyPaymentMinor: 64_000, interestRateBps: 489, monthlyInterestMinor: 64_000, repaymentType: "INTEREST_ONLY", productName: "5-year fixed", productEndDate: new Date("2026-09-30") },
    ],
  });

  // --- Valuation history ---
  await prisma.valuation.createMany({
    data: [
      { accountId: ACCOUNT_ID, propertyId: oak.id, amountMinor: 28_500_000, date: new Date("2019-09-12"), source: "purchase" },
      { accountId: ACCOUNT_ID, propertyId: oak.id, amountMinor: 33_000_000, date: new Date("2024-11-01"), source: "estimate" },
      { accountId: ACCOUNT_ID, propertyId: station.id, amountMinor: 41_000_000, date: new Date("2021-03-30"), source: "purchase" },
      { accountId: ACCOUNT_ID, propertyId: station.id, amountMinor: 47_000_000, date: new Date("2025-05-01"), source: "estimate" },
      { accountId: ACCOUNT_ID, propertyId: harbour.id, amountMinor: 23_000_000, date: new Date("2026-01-01"), source: "estimate" },
    ],
  });

  // --- Transactions (≥3 rental on Harbourside; Station June rent missing) ---
  await prisma.transaction.createMany({
    data: [
      // Oakfield Road
      { accountId: ACCOUNT_ID, portfolioId: personal.id, propertyId: oak.id, tenancyId: oakTenancy.id, bankAccountId: bank.id, date: new Date("2026-05-01"), rentDueDate: new Date("2026-05-01"), direction: "INCOME", amountMinor: 125_000, category: "RENT", description: "Rent — J Fletcher", source: "BANK_FEED", reconciled: true, externalId: "oak-rent-may" },
      { accountId: ACCOUNT_ID, portfolioId: personal.id, propertyId: oak.id, tenancyId: oakTenancy.id, bankAccountId: bank.id, date: new Date("2026-06-01"), rentDueDate: new Date("2026-06-01"), direction: "INCOME", amountMinor: 125_000, category: "RENT", description: "Rent — J Fletcher", source: "BANK_FEED", reconciled: true, externalId: "oak-rent-jun" },
      { accountId: ACCOUNT_ID, portfolioId: personal.id, propertyId: oak.id, bankAccountId: bank.id, date: new Date("2026-05-20"), direction: "EXPENSE", amountMinor: 18_600, category: "REPAIRS_MAINTENANCE", subcategory: "Heating", description: "Boiler service & repair", notes: "Annual service + thermostat", source: "BANK_FEED", reconciled: true, externalId: "oak-boiler" },
      // Station Mews
      { accountId: ACCOUNT_ID, portfolioId: business.id, propertyId: station.id, tenancyId: stationTenancy.id, bankAccountId: bank.id, date: new Date("2026-05-05"), rentDueDate: new Date("2026-05-05"), direction: "INCOME", amountMinor: 160_000, category: "RENT", description: "Rent — A Bennett", source: "BANK_FEED", reconciled: true, externalId: "station-rent-may" },
      { accountId: ACCOUNT_ID, portfolioId: business.id, propertyId: station.id, bankAccountId: bank.id, date: new Date("2026-05-28"), direction: "EXPENSE", amountMinor: 64_000, category: "FINANCE_COSTS", description: "BTL mortgage interest", source: "BANK_FEED", reconciled: true, externalId: "station-mortgage-may" },
      // Harbourside — three monthly rent payments of £500 (ongoing tenancy)
      { accountId: ACCOUNT_ID, portfolioId: personal.id, propertyId: harbour.id, tenancyId: harbourTenancy.id, bankAccountId: bank.id, date: new Date("2026-04-15"), rentDueDate: new Date("2026-04-15"), direction: "INCOME", amountMinor: 50_000, category: "RENT", description: "Rent — M Costa", source: "BANK_FEED", reconciled: true, externalId: "harbour-rent-apr" },
      { accountId: ACCOUNT_ID, portfolioId: personal.id, propertyId: harbour.id, tenancyId: harbourTenancy.id, bankAccountId: bank.id, date: new Date("2026-05-15"), rentDueDate: new Date("2026-05-15"), direction: "INCOME", amountMinor: 50_000, category: "RENT", description: "Rent — M Costa", source: "BANK_FEED", reconciled: true, externalId: "harbour-rent-may" },
      { accountId: ACCOUNT_ID, portfolioId: personal.id, propertyId: harbour.id, tenancyId: harbourTenancy.id, bankAccountId: bank.id, date: new Date("2026-06-15"), rentDueDate: new Date("2026-06-15"), direction: "INCOME", amountMinor: 50_000, category: "RENT", description: "Rent — M Costa", source: "BANK_FEED", reconciled: false, externalId: "harbour-rent-jun" },
      // Untracked transaction (no property) → default portfolio
      { accountId: ACCOUNT_ID, portfolioId: personal.id, bankAccountId: bank.id, date: new Date("2026-06-18"), direction: "EXPENSE", amountMinor: 4_800, description: "SCREWFIX BRISTOL", source: "BANK_FEED", reconciled: false, externalId: "screwfix-jun" },
    ],
  });

  // --- Notes (linked to property / tenant) ---
  const oakTenant = await prisma.tenant.findFirst({ where: { tenancyId: oakTenancy.id } });
  await prisma.note.create({
    data: { accountId: ACCOUNT_ID, propertyId: oak.id, description: "Boiler replaced under warranty in May; next service due 2027.", date: new Date("2026-05-20") },
  });
  if (oakTenant) {
    await prisma.note.create({
      data: { accountId: ACCOUNT_ID, tenantId: oakTenant.id, description: "Tenant requested permission to keep a cat — approved.", date: new Date("2026-03-02") },
    });
  }

  // --- Reminders (standalone + linked to a document) ---
  const oakGas = await prisma.document.findFirst({ where: { propertyId: oak.id, category: "GAS_SAFETY" } });
  await prisma.reminder.create({
    data: { accountId: ACCOUNT_ID, propertyId: oak.id, documentId: oakGas?.id, name: "Renew gas safety certificate", description: "Oakfield Road CP12 expires soon — book an engineer.", dueDate: new Date("2026-07-10"), status: "OPEN" },
  });
  await prisma.reminder.create({
    data: { accountId: ACCOUNT_ID, propertyId: station.id, tenancyId: stationTenancy.id, name: "Chase rent arrears", description: "Station Mews — one month outstanding.", dueDate: new Date("2026-06-22"), status: "OPEN" },
  });

  // --- Tax statements (portfolio + owner scope) ---
  await prisma.taxStatement.createMany({
    data: [
      { accountId: ACCOUNT_ID, scope: "PORTFOLIO", portfolioId: personal.id, taxYear: "2026/27", totalIncomeMinor: 525_000, totalExpensesMinor: 23_400, estimatedTaxMinor: 100_320, computedAt: now },
      { accountId: ACCOUNT_ID, scope: "OWNER", beneficialOwnerId: boBen.id, taxYear: "2026/27", totalIncomeMinor: 621_000, totalExpensesMinor: 61_000, estimatedTaxMinor: 112_000, computedAt: now },
    ],
  });

  // --- MTD obligations + a fulfilled prior submission ---
  const priorQ4 = await prisma.mtdObligation.create({
    data: { accountId: ACCOUNT_ID, taxYear: "2025/26", period: "Q4", startDate: new Date("2026-01-06"), endDate: new Date("2026-04-05"), dueDate: new Date("2026-05-07"), status: "FULFILLED" },
  });
  await prisma.mtdSubmission.create({
    data: { accountId: ACCOUNT_ID, obligationId: priorQ4.id, submittedAt: new Date("2026-04-22T10:14:00Z"), totalIncomeMinor: 1_170_000, totalExpensesMinor: 438_000, receiptRef: "HMRC-MTD-2526Q4-8F3A21" },
  });
  await prisma.mtdObligation.createMany({
    data: [
      { accountId: ACCOUNT_ID, taxYear: "2026/27", period: "Q1", startDate: new Date("2026-04-06"), endDate: new Date("2026-07-05"), dueDate: new Date("2026-08-07"), status: "OPEN" },
      { accountId: ACCOUNT_ID, taxYear: "2026/27", period: "Q2", startDate: new Date("2026-07-06"), endDate: new Date("2026-10-05"), dueDate: new Date("2026-11-07"), status: "OPEN" },
      { accountId: ACCOUNT_ID, taxYear: "2026/27", period: "Q3", startDate: new Date("2026-10-06"), endDate: new Date("2027-01-05"), dueDate: new Date("2027-02-07"), status: "OPEN" },
      { accountId: ACCOUNT_ID, taxYear: "2026/27", period: "Q4", startDate: new Date("2027-01-06"), endDate: new Date("2027-04-05"), dueDate: new Date("2027-05-07"), status: "OPEN" },
    ],
  });

  const rentTxns = await prisma.transaction.count({ where: { accountId: ACCOUNT_ID, category: "RENT" } });
  // eslint-disable-next-line no-console
  console.log(
    `\n✅ Seeded account "Walpole Property Holdings"\n` +
      `   • 3 properties across personal + business portfolios (mortgages, valuations, EPC)\n` +
      `   • Harbourside tenancy: £500/mo, ongoing (no end date), tenant Maria Costa\n` +
      `   • ${rentTxns} rental transactions, 1 in arrears (Station Mews), notes/reminders/tax statements\n` +
      `   • login: ${DEMO_EMAIL} / ${DEMO_PASSWORD}\n`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
