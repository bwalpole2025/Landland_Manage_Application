import { describe, it, expect, afterAll } from "vitest";
import { authenticator } from "otplib";

import { formatGBP, poundsToPence } from "@/lib/money";
import { generateTotpSecret, verifyTotp } from "@/server/auth/totp";
import { hashPassword, verifyPassword } from "@/server/auth/password";
import { authenticate, AuthError } from "@/server/auth/service";
import { beginTotpEnrolment, confirmTotpEnrolment, TwoFactorError } from "@/server/auth/twofactor";
import { rentDueDateOf, computeArrears } from "@/lib/arrears";
import { getTransactions, getActiveTenancyForProperty, getProperties, getTenancies } from "@/services/repository";
import { filterTransactions, hasActiveFilters } from "@/lib/transactions-filter";
import { estimateTax } from "@/lib/tax";
import { getTaxConfig, TAX_YEAR_CONFIGS } from "@/lib/tax-config";
import { suggestCategorisation, type SuggestContext } from "@/lib/categorisation";
import type { Transaction } from "@/lib/types";
import { getPropertiesSummary, getPropertyFigures, getPropertyPnl12m, recentTaxYears } from "@/lib/properties";
import { getOwnerSplit, getBeneficialOwners, getPortfolioOwnership, ownerShareOfProperty, estimateTaxForOwner } from "@/lib/ownership";
import { generateRentSchedule, nextRentDueDate } from "@/lib/tenancies";
import { createTenancy, removeTenancy, createDocument, removeDocument, getComplianceDocuments } from "@/services/repository";
import { reminderSchedule, withinExpiryWindow, categoryIdForDoc } from "@/lib/documents";
import { getAggregatedNotes } from "@/lib/notes";
import { getCalendarEvents, todayInZone } from "@/lib/calendar";
import { getReminders, createReminder, completeReminder, removeReminder, clearCompletedReminders } from "@/services/repository";
import {
  getPortfolios, getMortgageForProperty, getCurrentValuation, getInsurancePolicies,
  getProperty, getNotes, archiveProperty, restoreProperty,
} from "@/services/repository";
import { loanToValuePercent } from "@/lib/finance";
import { MockBankFeedProvider } from "@/server/providers/bank-feed";
import { MockHmrcMtdProvider, HmrcApiError, REQUIRED_FRAUD_HEADERS } from "@/server/providers/hmrc-mtd";
import { buildFraudPreventionHeaders, missingFraudHeaders } from "@/server/mtd/fraud-headers";
import { getAllProperties, getCompanies, getUsers, getDirectorLoanMovements } from "@/services/repository";
import { buildReport, REPORT_DEFS, type ReportDataset, type ReportFilters } from "@/lib/reports/build";
import { reportToCsv } from "@/lib/reports/csv";
import { reportToPdf } from "@/lib/reports/pdf";
import { directionTotals, operatingPnl } from "@/lib/reports/totals";
import { getYtdTotals } from "@/lib/portfolio";
import { taxYearBounds } from "@/lib/dates";
import { normalizeBankTransaction, mergeDeduped, dedupeKey } from "@/lib/ingest";
import { parseCsv, autoMap, validateImport, SAMPLE_CSV, resetImportSeq } from "@/lib/import/csv";
import { acceptInvitation } from "@/server/auth/invitations";
import { hashToken } from "@/server/auth/tokens";
import { appRouter } from "@/server/routers/_app";
import { prisma } from "@/server/db";
import {
  DEFAULT_PREFERENCES,
  deliveryKey,
  planDeliveries,
  isoDaysUntil,
  documentExpiryEvents,
  arrearsEvents,
  rentReminderEvents,
  bankFeedEvents,
  mtdDeadlineEvents,
  collectNotificationEvents,
} from "@/lib/notifications";
import { runNotificationScan, savePreferences } from "@/server/notifications";
import { InMemoryStoragePort, ownerOf } from "@integrations";
import { uploadEvidence, confirmExpiry, confirmGasInspection, confirmedEngineEvidence, listEvidence } from "@/server/documents/service";
import { evaluateProperty } from "@/server/compliance/evaluate";
import { saveDeposit, saveCurrentTenancy } from "@/server/compliance/records";
import { saveSchedule, addManualReceipt, assessRentForProperty } from "@/server/compliance/rent";
import { addLicence } from "@/server/compliance/licensing";
import { appendActivity } from "@/server/compliance/activity";
import { evaluate as evaluateObligations, nextGasDue, UK_RULES, type ApplicabilityProfile as EngineProfile } from "@obligations-engine";
import { encryptSecret, decryptSecret, isEncrypted } from "@/server/security/encryption";
import { recordAudit, listAudit } from "@/server/security/audit";
import { exportAccountData, deleteAccount } from "@/server/security/gdpr";
import {
  subscriptionView,
  projectedFirstCharge,
  formatChargeDate,
  trialEndFrom,
  planPriceLabel,
} from "@/lib/subscription";
import { completeCheckout, viewForAccount } from "@/server/billing/service";
import { MockPaymentProvider } from "@/server/providers/payments";
import type { AppSession } from "@/server/auth/session";
import {
  getArrearsList,
  getAssetAnalysis,
  getLast12MonthsPnl,
  getMarketRisk,
  getOccupancy,
  getRentCollection,
  getRentalYields,
  getUpcomingPayments,
} from "@/lib/overview";

/** Build a minimal owner session for an existing user + their home account. */
async function ownerSession(userId: string): Promise<AppSession> {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  return {
    user: {
      id: user.id,
      name: `${user.firstName} ${user.lastName}`.trim(),
      email: user.email,
      emailVerified: user.emailVerified !== null,
    },
    account: {
      id: user.accountId,
      name: "Test",
      type: "individual",
      mtd: { enrolled: false },
      subscription: { status: "TRIALING", trialEndsAt: null, billingStartsAt: null },
    },
    role: "owner",
    isDelegated: false,
  };
}

// ---------------------------------------------------------------------------
// Unit checks — always run (no infrastructure required).
// ---------------------------------------------------------------------------

describe("money (integer pence)", () => {
  it("formats GBP", () => {
    expect(formatGBP(125000)).toBe("£1,250.00");
    expect(formatGBP(0)).toBe("£0.00");
  });
  it("converts pounds to integer pence", () => {
    expect(poundsToPence(12.34)).toBe(1234);
  });
});

describe("TOTP two-factor", () => {
  it("verifies a freshly-generated code and rejects garbage", () => {
    const secret = generateTotpSecret();
    expect(verifyTotp(authenticator.generate(secret), secret)).toBe(true);
    expect(verifyTotp("not-a-code", secret)).toBe(false);
  });
});

describe("password hashing", () => {
  it("hashes and verifies", async () => {
    const hash = await hashPassword("correct horse battery staple");
    expect(hash).not.toContain("correct horse");
    expect(await verifyPassword("correct horse battery staple", hash)).toBe(true);
    expect(await verifyPassword("wrong", hash)).toBe(false);
  });
});

describe("overview dashboard aggregations (mock repository)", () => {
  it("occupancy reflects the portfolio", () => {
    const o = getOccupancy();
    expect(o.available).toBe(3);
    expect(o.occupied).toBe(3);
    expect(o.vacant).toBe(0);
    expect(o.occupancyPercent).toBe(100);
  });

  it("P&L (last 12 months) has data and profit = income − expenses", () => {
    const p = getLast12MonthsPnl();
    expect(p.hasData).toBe(true);
    expect(p.incomePence).toBeGreaterThan(0);
    expect(p.profitPence).toBe(p.incomePence - p.expensesPence);
  });

  it("rental yields unlock once rent is tracked + purchase prices entered", () => {
    const y = getRentalYields();
    expect(y.locked).toBe(false);
    expect(y.rows.length).toBe(3);
    expect(y.basis).toBe("valuation"); // valuations cover all properties
    expect(y.averagePercent).toBeGreaterThan(0);
    expect(y.taxYear).toBe("2026/27");
  });

  it("asset analysis: accurate coverage ratios, totals and LTV", () => {
    const a = getAssetAnalysis();
    // Coverage ratios are accurate (3/3 valuation & purchase, 2/3 mortgage).
    expect(a.valuation).toMatchObject({ count: 3, total: 3, percent: 100 });
    expect(a.purchasePrice).toMatchObject({ count: 3, total: 3, percent: 100 });
    expect(a.mortgage).toMatchObject({ count: 2, total: 3, percent: 67 });
    // Totals sum the underlying data.
    expect(a.valuation.totalPence).toBe(poundsToPence(320000 + 445000 + 248000));
    expect(a.mortgage.totalPence).toBe(poundsToPence(190000 + 280000));
    // LTV = total mortgage ÷ total valuation = 470,000 / 1,013,000 ≈ 46.4%.
    expect(a.ltvPercent).toBeCloseTo(46.4, 1);
    expect(a.portfolioDataPercent).toBe(Math.round((100 + 100 + 67) / 3));
  });

  it("market risk compares valuation to purchase price", () => {
    const m = getMarketRisk();
    expect(m.hasData).toBe(true);
    expect(m.totalValuationPence).toBe(poundsToPence(1013000));
    expect(m.totalPurchasePence).toBe(poundsToPence(925000));
    expect(m.equityGainPence).toBe(poundsToPence(88000));
    expect(m.growthPercent).toBeCloseTo(9.51, 1);
  });

  it("rent collection is the current month, matched by rent due date", () => {
    const rc = getRentCollection();
    expect(rc.hasData).toBe(true);
    expect(rc.month).toBe("June 2026");
    expect(rc.expectedPence).toBe(poundsToPence(1250 + 1600 + 1100)); // 3,950
    expect(rc.receivedPence).toBe(poundsToPence(1250 + 1100)); // Oak + Harbour; Station June missing
    expect(rc.percent).toBe(59); // 2,350 / 3,950
  });

  it("arrears lists tenants with property address + missing due dates", () => {
    const rows = getArrearsList();
    const station = rows.find((r) => r.propertyName === "Station Mews");
    expect(station).toBeTruthy();
    expect(station!.status).toBe("in_arrears");
    expect(station!.tenantName).toBe("Aisha Bennett");
    expect(station!.propertyAddress).toContain("Bath");
    expect(station!.missingDueDates.length).toBeGreaterThan(0); // June rent unmatched
    // Every tracked tenancy here has rent, so none are "untracked".
    expect(rows.every((r) => r.status === "in_arrears")).toBe(true);
  });

  it("rent is matched by rent due date, not bank date", () => {
    const aprilOak = getTransactions().find((t) => t.tenancyId === "ten_oak" && t.date === "2026-04-08");
    expect(aprilOak).toBeTruthy();
    expect(rentDueDateOf(aprilOak!)).toBe("2026-04-01"); // due on the 1st, banked on the 8th
  });

  it("upcoming payments are the next future due date per tenancy", () => {
    const upcoming = getUpcomingPayments();
    expect(upcoming.length).toBe(3);
    expect(upcoming.every((p) => p.dueDate >= "2026-06-20")).toBe(true);
  });
});

describe("transactions ledger filters (compose with AND)", () => {
  const rows = getTransactions();

  it("filters narrow independently", () => {
    expect(filterTransactions(rows, { type: "income" }).every((t) => t.direction === "income")).toBe(true);
    expect(filterTransactions(rows, { propertyId: "p_oak" }).every((t) => t.propertyId === "p_oak")).toBe(true);
    expect(filterTransactions(rows, { category: "rent" }).every((t) => t.category === "rent")).toBe(true);
    expect(filterTransactions(rows, { source: "manual" }).every((t) => t.source === "manual")).toBe(true);
  });

  it("multiple filters compose (AND)", () => {
    const out = filterTransactions(rows, { propertyId: "p_oak", type: "income", category: "rent" });
    expect(out.length).toBeGreaterThan(0);
    expect(out.every((t) => t.propertyId === "p_oak" && t.direction === "income" && t.category === "rent")).toBe(true);
    // Composed result is a subset of any single filter.
    expect(out.length).toBeLessThanOrEqual(filterTransactions(rows, { propertyId: "p_oak" }).length);
  });

  it("amount range filters by pence bounds", () => {
    const out = filterTransactions(rows, { minPence: 100000, maxPence: 130000 });
    expect(out.every((t) => t.amountPence >= 100000 && t.amountPence <= 130000)).toBe(true);
  });

  it("hasActiveFilters reflects state", () => {
    expect(hasActiveFilters({})).toBe(false);
    expect(hasActiveFilters({ type: "expense" })).toBe(true);
    expect(hasActiveFilters({ minPence: 0 })).toBe(true);
  });
});

describe("categorisation & SA105 mapping", () => {
  function suggestCtx(): SuggestContext {
    return {
      properties: getProperties().map((p) => ({ id: p.id, nickname: p.nickname })),
      tenancies: getTenancies().map((t) => ({
        id: t.id,
        propertyId: t.propertyId,
        tenantNames: t.tenants.map((x) => x.name),
        rentPence: t.rentPence,
      })),
    };
  }

  // The headline acceptance criterion.
  it("categorising a rent payment links the tenancy and clears arrears", () => {
    const station = getActiveTenancyForProperty("p_station")!;
    const txns = getTransactions();

    // Station Mews is in arrears because June's payment is un-categorised.
    expect(computeArrears(station, txns).status).toBe("in_arrears");

    // The un-linked incoming June payment.
    const payment = txns.find(
      (t) => t.direction === "income" && !t.tenancyId && t.amountPence === 160000 && t.date.startsWith("2026-06"),
    );
    expect(payment).toBeTruthy();

    // Categorise it as rent and link the correct tenancy/property.
    const categorised = txns.map((t) =>
      t.id === payment!.id ? { ...t, category: "rent" as const, propertyId: "p_station", tenancyId: "ten_station" } : t,
    );

    // Arrears for that tenancy is now cleared.
    expect(computeArrears(station, categorised).status).not.toBe("in_arrears");
  });

  it("auto-suggest proposes rent + the correct tenancy from the payee", () => {
    const payment = getTransactions().find((t) => /BENNETT/.test(t.description) && !t.tenancyId)!;
    const s = suggestCategorisation(payment, suggestCtx());
    expect(s).toBeTruthy();
    expect(s!.optionValue).toBe("rent");
    expect(s!.category).toBe("rent");
    expect(s!.propertyId).toBe("p_station");
    expect(s!.tenancyId).toBe("ten_station");
  });

  it("auto-suggest classifies expenses from the description", () => {
    const ctx = suggestCtx();
    const mk = (description: string): Transaction =>
      ({ description, amountPence: 5000, direction: "expense" } as Transaction);
    expect(suggestCategorisation(mk("SCREWFIX BRISTOL"), ctx)!.category).toBe("repairs_maintenance");
    expect(suggestCategorisation(mk("BTL mortgage interest"), ctx)!.category).toBe("finance_costs");
    expect(suggestCategorisation(mk("Letting agent fee"), ctx)!.category).toBe("professional_fees");
    expect(suggestCategorisation(mk("Aviva landlord insurance"), ctx)!.subcategory).toBe("Insurance");
  });

  it("tax excludes deposits, capital expenses and deactivated items", () => {
    const base = { accountId: "a", date: "2026-05-01", source: "manual", reconcile: "reconciled" } as const;
    const txs: Transaction[] = [
      { ...base, id: "i", direction: "income", category: "rent", amountPence: 100000, description: "rent" },
      { ...base, id: "d", direction: "income", category: "deposit", amountPence: 150000, description: "deposit" },
      { ...base, id: "c", direction: "expense", category: "capital_expense", amountPence: 500000, description: "new kitchen" },
      { ...base, id: "e", direction: "expense", category: "repairs_maintenance", amountPence: 20000, description: "fix" },
      { ...base, id: "x", direction: "income", category: "rent", amountPence: 999999, description: "dup", deactivated: true },
    ];
    const est = estimateTax(txs, "2026/27");
    expect(est.totalIncomePence).toBe(100000); // deposit + deactivated excluded
    expect(est.totalExpensesPence).toBe(20000); // capital excluded
    // Neither excluded category appears as an SA105 box.
    expect(est.boxes.some((b) => b.box === "—")).toBe(false);
  });
});

describe("properties screen rollups", () => {
  it("summary counts match the data", () => {
    const s = getPropertiesSummary();
    expect(s.portfolioCount).toBe(getPortfolios().length);
    expect(s.propertyCount).toBe(getProperties().length); // 3
    expect(s.activeTenancyCount).toBe(3);
    expect(s.vacantCount).toBe(0);
    expect(s.arrearsPence).toBeGreaterThan(0); // Station Mews behind
  });

  it("per-tax-year figures: profit = income − expenses, and empty past years", () => {
    const f = getPropertyFigures("p_oak", "2026/27");
    expect(f.incomePence).toBeGreaterThan(0);
    expect(f.profitPence).toBe(f.incomePence - f.expensesPence);
    // A property with no transactions in an earlier year reads as zero.
    const past = getPropertyFigures("p_oak", "2024/25");
    expect(past.incomePence).toBe(0);
    expect(past.expensesPence).toBe(0);
  });

  it("station mews carries arrears in its figures", () => {
    expect(getPropertyFigures("p_station", "2026/27").arrearsPence).toBeGreaterThan(0);
  });

  it("recentTaxYears lists the current year first, descending", () => {
    const years = recentTaxYears("2026/27", 3);
    expect(years).toEqual(["2026/27", "2025/26", "2024/25"]);
  });

  it("property detail widgets are scoped to the property", () => {
    // P&L over 12 months only sums this property's transactions.
    const oak = getPropertyPnl12m("p_oak");
    const station = getPropertyPnl12m("p_station");
    expect(oak.hasData).toBe(true);
    expect(oak.incomePence).not.toBe(station.incomePence); // genuinely per-property
    // Notes + insurance are property-scoped.
    expect(getNotes("p_oak").every((n) => n.propertyId === "p_oak")).toBe(true);
    expect(getNotes("p_oak").length).toBeGreaterThan(0);
    expect(getInsurancePolicies("p_station").every((i) => i.propertyId === "p_station")).toBe(true);
  });

  it("archive removes from active lists but preserves history", () => {
    const before = getProperties().length;
    try {
      archiveProperty("p_harbour", "2026-06-20T12:00:00.000Z");
      // Removed from active lists…
      expect(getProperties().some((p) => p.id === "p_harbour")).toBe(false);
      expect(getProperties().length).toBe(before - 1);
      // …but the record + its history are preserved.
      const still = getProperty("p_harbour");
      expect(still).toBeTruthy();
      expect(still!.archivedAt).toBeTruthy();
      expect(getPropertyFigures("p_harbour", "2026/27").incomePence).toBeGreaterThan(0); // history intact
    } finally {
      restoreProperty("p_harbour"); // clean up shared state
    }
    expect(getProperties().some((p) => p.id === "p_harbour")).toBe(true);
  });

  it("insurance is per property; mortgages feed LTV", () => {
    expect(getInsurancePolicies("p_oak").length).toBe(1);
    const m = getMortgageForProperty("p_oak")!;
    const val = getCurrentValuation("p_oak")!.amountPence;
    // £190,000 balance / £320,000 valuation ≈ 59.4%.
    expect(loanToValuePercent(m.balancePence, val)).toBeCloseTo(59.4, 1);
    expect(getMortgageForProperty("p_harbour")).toBeUndefined(); // owned outright
  });
});

describe("calendar events", () => {
  // The headline acceptance criterion.
  it("a monthly view shows rent payments and document expiries on their dates", () => {
    const events = getCalendarEvents("2026-06-01", "2026-06-30");
    const payments = events.filter((e) => e.type === "payment");
    // Rent due dates in June for the active tenancies (Oak 1st, Station 5th, Harbour 15th).
    expect(payments.some((e) => e.date === "2026-06-01")).toBe(true);
    expect(payments.some((e) => e.date === "2026-06-05")).toBe(true);
    expect(payments.some((e) => e.date === "2026-06-15")).toBe(true);
    expect(payments[0].title).toMatch(/^Rent — /);
    // Document expiries land on their dates (Oak insurance 15 Jun, Station EICR 25 Jun).
    const expiries = events.filter((e) => e.type === "expiry");
    expect(expiries.some((e) => e.date === "2026-06-15")).toBe(true);
    expect(expiries.some((e) => e.date === "2026-06-25")).toBe(true);
  });

  it("the next rent due appears as an upcoming-payment chip linking to its tenancy", () => {
    // From today (2026-06-20) the next rent due dates fall in July.
    const july = getCalendarEvents("2026-07-01", "2026-07-31").filter((e) => e.type === "payment");
    expect(july.some((e) => e.date === "2026-07-01")).toBe(true); // Oak's next rent
    expect(july.every((e) => e.href.startsWith("/properties/"))).toBe(true); // click → source
    expect(july.every((e) => e.amountPence! > 0)).toBe(true);
  });

  it("reminders + account events render with source links; uses the account time zone", () => {
    const events = getCalendarEvents("2026-06-01", "2026-08-31", { trialEndsAt: "2026-07-04T00:00:00.000Z" });
    expect(events.some((e) => e.type === "reminder" && e.href === "/files/reminders")).toBe(true);
    expect(events.some((e) => e.type === "account" && e.date === "2026-07-04")).toBe(true);
    expect(todayInZone("Europe/London")).toBe("2026-06-20");
  });
});

describe("notes aggregation", () => {
  it("aggregates notes from properties, tenancies and transactions", () => {
    const notes = getAggregatedNotes();
    expect(notes.some((n) => n.linkedToType === "property")).toBe(true);
    expect(notes.some((n) => n.linkedToType === "tenant")).toBe(true); // station note has a tenancy
    expect(notes.some((n) => n.linkedToType === "transaction")).toBe(true); // boiler tx note
    // Each note carries a Linked-To label, description and date.
    expect(notes.every((n) => n.linkedToLabel && n.description && n.date)).toBe(true);
  });

  it("transaction notes link to the right tenant/property", () => {
    const tenantNote = getAggregatedNotes().find((n) => n.tenancyId === "ten_station" && n.linkedToType === "tenant");
    expect(tenantNote?.linkedToLabel).toBe("Aisha Bennett");
  });
});

describe("reminders", () => {
  // The headline acceptance criterion.
  it("creating a reminder shows under 'My work' and on the calendar; completing moves it to 'Completed'", () => {
    let id: string | null = null;
    try {
      const r = createReminder({ name: "Test reminder", description: "verify", dueDate: "2026-07-15" });
      id = r.id;

      // Open → appears under "My work" (status open) and on the calendar (open + dueDate).
      const open = getReminders().filter((x) => x.status === "open");
      expect(open.some((x) => x.id === r.id)).toBe(true);
      const calendarReminders = getReminders().filter((x) => x.status === "open" && x.dueDate);
      expect(calendarReminders.some((x) => x.id === r.id)).toBe(true);

      // Complete → moves to "Completed".
      completeReminder(r.id, "2026-06-20T12:00:00.000Z");
      expect(getReminders().find((x) => x.id === r.id)?.status).toBe("completed");
      expect(getReminders().filter((x) => x.status === "open").some((x) => x.id === r.id)).toBe(false);
    } finally {
      if (id) removeReminder(id);
    }
  });

  it("clear removes completed reminders only", () => {
    const r1 = createReminder({ name: "Done one", dueDate: "2026-07-01", status: "completed" });
    const r2 = createReminder({ name: "Still open", dueDate: "2026-07-02" });
    try {
      clearCompletedReminders();
      expect(getReminders().some((x) => x.id === r1.id)).toBe(false); // completed cleared
      expect(getReminders().some((x) => x.id === r2.id)).toBe(true); // open kept
    } finally {
      removeReminder(r2.id);
    }
  });
});

describe("documents: categories, reminders & upload", () => {
  it("reminderSchedule fires 30/14/7/1 days before expiry (future only)", () => {
    // Far expiry → all four reminders are still in the future.
    const r = reminderSchedule("2026-09-15", true);
    expect(r.map((x) => x.daysBefore)).toEqual([30, 14, 7, 1]);
    expect(r[0].date).toBe("2026-08-16"); // 30 days before 15 Sep
    expect(r[3].date).toBe("2026-09-14"); // 1 day before
  });

  it("reminders respect notification preferences", () => {
    expect(reminderSchedule("2026-09-15", false)).toEqual([]); // notifications off
    expect(reminderSchedule(undefined, true)).toEqual([]); // no expiry
  });

  it("expiry window filter includes only docs expiring within the window", () => {
    expect(withinExpiryWindow("2026-07-01", 14)).toBe(true); // ~11 days away
    expect(withinExpiryWindow("2026-12-01", 14)).toBe(false); // far out
    expect(withinExpiryWindow(undefined, 30)).toBe(false);
    expect(withinExpiryWindow("2026-12-01", null)).toBe(true); // "Any"
  });

  it("legacy doc types map onto categories", () => {
    expect(categoryIdForDoc({ type: "gas_safety" })).toBe("gas_safety");
    expect(categoryIdForDoc({ type: "eicr" })).toBe("electrical_safety");
    expect(categoryIdForDoc({ type: "other", category: "logo" })).toBe("logo");
  });

  // The headline acceptance criterion.
  it("uploading a Gas Safety Certificate with expiry creates a calendar entry + scheduled reminders", () => {
    const doc = createDocument({
      propertyId: "p_oak",
      type: "gas_safety",
      category: "gas_safety",
      title: "Gas Safety Certificate (CP12)",
      fileRef: "/files/oak-gas-2026.pdf",
      issueDate: "2026-08-15",
      expiryDate: "2026-09-15",
    });
    try {
      // The calendar reads compliance documents with an expiry → entry created.
      const calendarDocs = getComplianceDocuments().filter((d) => d.expiryDate);
      expect(calendarDocs.some((d) => d.id === doc.id)).toBe(true);
      // Reminders are scheduled at 30/14/7/1 days before.
      const reminders = reminderSchedule(doc.expiryDate, true);
      expect(reminders).toHaveLength(4);
      expect(reminders.map((r) => r.daysBefore)).toEqual([30, 14, 7, 1]);
    } finally {
      removeDocument(doc.id);
    }
    expect(getComplianceDocuments().some((d) => d.id === doc.id)).toBe(false);
  });
});

describe("tenancies: schedule + creation", () => {
  it("generateRentSchedule produces the expected monthly due dates", () => {
    const s = generateRentSchedule(
      { rentDueDay: 1, rentPence: poundsToPence(1000), rentFrequency: "monthly", startDate: "2026-07-01" },
      "2026-06-20",
      3,
    );
    expect(s.map((e) => e.dueDate)).toEqual(["2026-07-01", "2026-08-01", "2026-09-01"]);
    expect(s.every((e) => e.amountPence === poundsToPence(1000))).toBe(true);
  });

  it("nextRentDueDate is the next due on/after today", () => {
    // Today is 2026-06-20; due day 5 has passed this month → next is 5 Jul.
    expect(nextRentDueDate({ rentDueDay: 5, rentPence: 100000, rentFrequency: "monthly", startDate: "2026-01-05" })).toBe("2026-07-05");
  });

  // The headline acceptance criterion.
  it("creating a tenancy updates occupancy and produces an upcoming payment", () => {
    const harbour = getTenancies().find((t) => t.id === "ten_harbour")!;
    const originalStatus = harbour.status;
    let createdId: string | null = null;
    try {
      harbour.status = "ended"; // Harbourside is now vacant
      expect(getOccupancy().occupied).toBe(2);

      const created = createTenancy({
        propertyId: "p_harbour",
        tenants: [{ id: "tn_new", name: "Priya Test" }],
        startDate: "2026-06-01",
        rentPence: poundsToPence(900),
        rentFrequency: "monthly",
        rentDueDay: 10,
      });
      createdId = created.id;

      // Occupancy is updated…
      expect(getActiveTenancyForProperty("p_harbour")?.id).toBe(created.id);
      expect(getOccupancy().occupied).toBe(3);
      // …and an upcoming-payment entry (used by dashboard + calendar) appears.
      const upcoming = getUpcomingPayments(undefined, 20);
      expect(upcoming.some((p) => p.tenantName === "Priya Test")).toBe(true);
    } finally {
      if (createdId) removeTenancy(createdId);
      harbour.status = originalStatus;
    }
    expect(getOccupancy().occupied).toBe(3); // back to seeded state
  });
});

describe("SA105 tax estimation engine", () => {
  function mkTx(over: Partial<Transaction>): Transaction {
    return { id: "t", accountId: "a", date: "2026-05-01", direction: "expense", amountPence: 0, description: "x", source: "manual", reconcile: "reconciled", ...over } as Transaction;
  }

  it("rates/allowances come from a versioned, per-tax-year config table", () => {
    const c = getTaxConfig("2026/27");
    expect(c.personalAllowancePence).toBe(1_257_000);
    expect(c.basicRate).toBe(0.2);
    expect(c.financeCostReliefRate).toBe(0.2);
    expect(c.version).toContain("2026/27");
    expect(Object.keys(TAX_YEAR_CONFIGS).length).toBeGreaterThan(2);
    // A future/unknown year falls back to a configured ruleset rather than crashing.
    expect(getTaxConfig("2099/00").personalAllowancePence).toBe(1_257_000);
  });

  it("outputs taxable income, allowable expenses and an estimate for seeded data", () => {
    const est = estimateTax(getTransactions(), "2026/27");
    expect(est.income.rentsReceivedPence).toBeGreaterThan(0); // SA105 income structure
    expect(est.allowableExpenses.length).toBeGreaterThan(0); // expenses by category
    expect(est.allowableExpenses.every((e) => e.sa105Box && e.amountPence > 0)).toBe(true);
    expect(est.taxableProfitPence).toBeGreaterThan(0);
    expect(typeof est.estimatedTaxPence).toBe("number");
    expect(est.appliedTaxYear).toBe("2026/27");
  });

  it("finance costs are a basic-rate reducer, not a deduction", () => {
    const txs = [
      mkTx({ id: "i", direction: "income", category: "rent", amountPence: poundsToPence(60000), description: "rent" }),
      mkTx({ id: "f", direction: "expense", category: "finance_costs", amountPence: poundsToPence(20000), description: "mortgage interest" }),
    ];
    const est = estimateTax(txs, "2026/27");
    expect(est.taxableProfitPence).toBe(poundsToPence(60000)); // finance NOT deducted from profit
    expect(est.financeCostsPence).toBe(poundsToPence(20000));
    expect(est.financeReliefPence).toBe(poundsToPence(4000)); // 20% reducer
    expect(est.taxBand).toBe("higher"); // banded tax forecast
    // A real deduction would give £40k profit; the reducer keeps it at £60k.
  });

  it("changing a category changes the result", () => {
    const base = [
      mkTx({ id: "i", direction: "income", category: "rent", amountPence: poundsToPence(30000), description: "rent" }),
      mkTx({ id: "e", direction: "expense", category: "repairs_maintenance", amountPence: poundsToPence(5000), description: "repairs" }),
    ];
    const before = estimateTax(base, "2026/27");
    // Re-categorise the repair as a capital expense (excluded from SA105).
    const after = estimateTax(base.map((t) => (t.id === "e" ? { ...t, category: "capital_expense" as const } : t)), "2026/27");
    expect(after.taxableProfitPence).toBeGreaterThan(before.taxableProfitPence);
    expect(after.estimatedTaxPence).not.toBe(before.estimatedTaxPence);
  });

  it("per-owner income & expense splits sum to the account total", () => {
    const total = estimateTax(getTransactions(), "2026/27");
    const owners = getBeneficialOwners();
    const sum = (pick: (e: ReturnType<typeof estimateTaxForOwner>) => number) =>
      owners.reduce((s, o) => s + pick(estimateTaxForOwner(o.id, "2026/27")), 0);
    // Every property's ownership sums to 100%, so the apportioned parts re-sum to the whole.
    expect(sum((e) => e.totalIncomePence)).toBe(total.totalIncomePence);
    expect(sum((e) => e.totalExpensesPence)).toBe(total.totalExpensesPence);
    expect(sum((e) => e.taxableProfitPence)).toBe(total.taxableProfitPence);
  });
});

describe("ownership & pro-rata tax", () => {
  it("beneficial owners and portfolio ownership are derived from holdings", () => {
    const owners = getBeneficialOwners();
    expect(owners.map((o) => o.name)).toContain("Sarah Walpole");
    expect(ownerShareOfProperty("u_sarah", "p_station")).toBe(50);
    // The personal portfolio has 2 properties (Oak, Station) and 2 owners (Ben, Sarah).
    const pf = getPortfolioOwnership("pf_personal");
    expect(pf.propertyCount).toBe(2);
    expect(pf.ownerCount).toBe(2);
  });

  // The headline acceptance criterion.
  it("a 50% owner gets a 50% split in their tax statement", () => {
    // Sarah holds 50% of Station Mews and nothing else.
    const sarah = getOwnerSplit("u_sarah", "2026/27");
    // Station's own taxable income for the year is £3,200 (Apr + May rent).
    const stationIncome = poundsToPence(1600 + 1600);
    expect(sarah.incomePence).toBe(stationIncome / 2); // exactly half
    expect(sarah.incomePence).toBe(poundsToPence(1600));

    // Ben holds 50% of Station too (+ 100% of Oak & Harbour), so his Station
    // share equals Sarah's — the split is genuinely pro-rata.
    const ben = getOwnerSplit("u_ben", "2026/27");
    expect(ben.incomePence).toBeGreaterThan(sarah.incomePence); // Ben owns more overall
  });

  it("apportions allowable expenses by share too", () => {
    const sarah = getOwnerSplit("u_sarah", "2026/27");
    // Station expenses: letting fees £384 + mortgage interest £1,280 = £1,664; Sarah's 50% = £832.
    expect(sarah.expensesPence).toBe(poundsToPence((384 + 1280) / 2));
  });
});

describe("reports", () => {
  const taxYear = "2026/27";
  const { start, end } = taxYearBounds(taxYear);
  const dataset: ReportDataset = {
    transactions: getTransactions(),
    properties: getAllProperties(),
    portfolios: getPortfolios(),
    companies: getCompanies(),
    tenancies: getTenancies(),
    users: getUsers(),
    directorLoans: getDirectorLoanMovements(),
    taxYear,
    today: "2026-06-20",
    timeZone: "Europe/London",
    generatedAt: "2026-06-20T12:00:00.000Z",
  };
  const allF: ReportFilters = { from: start, to: end, portfolioId: "" };

  it("every catalogued report builds for the seeded data", () => {
    expect(REPORT_DEFS).toHaveLength(11);
    for (const def of REPORT_DEFS) {
      const m = buildReport(dataset, def.id, allF);
      expect(m.title).toBe(def.name);
      expect(m.sections.length).toBeGreaterThan(0);
    }
  });

  it("general ledger lists income & expenses with totals", () => {
    const s = buildReport(dataset, "general-ledger", allF).sections[0];
    expect(s.rows.length).toBeGreaterThan(0);
    expect(Number(s.totals!.income)).toBeGreaterThan(0);
    expect(Number(s.totals!.expense)).toBeGreaterThan(0);
  });

  it("respects the portfolio filter", () => {
    const all = buildReport(dataset, "general-ledger", allF).sections[0].rows.length;
    const biz = buildReport(dataset, "general-ledger", { ...allF, portfolioId: "pf_business" }).sections[0].rows.length;
    expect(biz).toBeGreaterThan(0);
    expect(biz).toBeLessThan(all);
  });

  it("respects the date filter", () => {
    const wide = buildReport(dataset, "general-ledger", allF).sections[0].rows.length;
    const narrow = buildReport(dataset, "general-ledger", { ...allF, from: "2026-06-01", to: "2026-06-30" }).sections[0].rows.length;
    expect(narrow).toBeLessThan(wide);
    expect(narrow).toBeGreaterThan(0);
  });

  it("directors' loans group by company and director with a net balance", () => {
    const m = buildReport(dataset, "directors-loans", allF);
    const sec = m.sections[0];
    expect(sec.title).toContain("Walpole Lettings");
    expect(sec.rows.some((r) => r.director === "Benjamin Walpole")).toBe(true);
    expect(sec.totals).toBeDefined();
  });

  it("rent roll lists all tenancies (portfolio filter, no date)", () => {
    const m = buildReport(dataset, "rent-roll", allF);
    expect(m.sections[0].rows.length).toBe(getTenancies().length);
  });

  it("income statement excludes finance costs and capital from operating expenses", () => {
    const m = buildReport(dataset, "income-statement", allF);
    const opEx = m.sections.find((s) => s.title === "Operating expenses")!;
    expect(opEx.rows.some((r) => /finance|mortgage interest/i.test(String(r.category)))).toBe(false);
  });

  it("exports valid CSV", () => {
    const csv = reportToCsv(buildReport(dataset, "general-ledger", allF));
    expect(csv).toContain("General Ledger");
    expect(csv).toContain("Income");
    expect(csv.split("\r\n").length).toBeGreaterThan(3);
  });

  it("exports a structurally valid PDF for every report", () => {
    for (const def of REPORT_DEFS) {
      const bytes = reportToPdf(buildReport(dataset, def.id, allF));
      expect(bytes).toBeInstanceOf(Uint8Array);
      expect(String.fromCharCode(...bytes.slice(0, 8))).toBe("%PDF-1.4");
      expect(String.fromCharCode(...bytes.slice(-5))).toBe("%%EOF");
    }
  });

  // --- Reconciliation (the acceptance) ---
  const moneyRow = (m: ReturnType<typeof buildReport>, section: number, key: string, totalsKey = key) =>
    Number(m.sections[section].totals![totalsKey]);

  it("Annual Report P&L totals reconcile with the dashboard P&L (same period)", () => {
    const m = buildReport(dataset, "annual", allF);
    const dash = getYtdTotals(taxYear); // dashboard P&L, shared directionTotals
    expect(Number(m.sections[0].rows[0].amount)).toBe(dash.incomePence); // Total income
    expect(Number(m.sections[0].rows[1].amount)).toBe(dash.expensesPence); // Total expenses
    expect(Number(m.sections[0].rows[2].amount)).toBe(dash.netPence); // Net profit
  });

  it("Income Statement reconciles with the shared operating P&L", () => {
    const m = buildReport(dataset, "income-statement", allF);
    const op = operatingPnl(getTransactions().filter((t) => t.date >= start && t.date <= end));
    expect(moneyRow(m, 0, "amount")).toBe(op.incomePence);
    expect(moneyRow(m, 1, "amount")).toBe(op.expensesPence);
    expect(Number(m.sections[2].rows[0].amount)).toBe(op.netPence);
  });

  it("Hammock Tax Statement mirrors the Tax module output exactly", () => {
    const m = buildReport(dataset, "hammock-tax", allF);
    const est = estimateTax(getTransactions(), taxYear); // the Tax module
    expect(Number(m.sections[0].totals!.amount)).toBe(est.totalIncomePence);
    expect(Number(m.sections[2].rows[0].amount)).toBe(est.taxableProfitPence);
    expect(Number(m.sections[2].rows[3].amount)).toBe(est.estimatedTaxPence);
  });

  it("owner-filtered Tax Statement reconciles with the per-owner Tax module figure", () => {
    const owner = getBeneficialOwners()[0];
    const m = buildReport(dataset, "hammock-tax", { ...allF, ownerId: owner.id });
    const est = estimateTaxForOwner(owner.id, taxYear);
    expect(Number(m.sections[0].totals!.amount)).toBe(est.totalIncomePence);
    expect(Number(m.sections[2].rows[0].amount)).toBe(est.taxableProfitPence);
  });

  it("directionTotals exclude deactivated transactions (consistency)", () => {
    const rows = getTransactions().filter((t) => t.date >= start && t.date <= end);
    const withDeactivated = rows.filter((t) => t.deactivated);
    expect(withDeactivated.length).toBeGreaterThan(0); // there is a deactivated dupe in seed
    const t = directionTotals(rows);
    const naive = rows.filter((r) => r.direction === "income").reduce((s, r) => s + r.amountPence, 0);
    expect(t.incomePence).toBeLessThan(naive); // deactivated income excluded
  });

  it("property filter narrows to a single property", () => {
    const m = buildReport(dataset, "general-ledger", { ...allF, propertyId: "p_oak" });
    const props = new Set(m.sections[0].rows.map((r) => r.property));
    expect([...props].every((p) => p === "Oakfield Road")).toBe(true);
  });

  it("every report carries a Generated meta in the account time zone", () => {
    const m = buildReport(dataset, "general-ledger", allF);
    const gen = m.meta.find((x) => x.label === "Generated");
    expect(gen).toBeDefined();
    expect(gen!.value).toMatch(/GMT|BST|UTC/); // tz-aware
  });
});

describe("HMRC MTD sandbox flow", () => {
  const p = new MockHmrcMtdProvider();
  const REDIRECT = "http://localhost:3000/api/mtd/callback";
  const headers = buildFraudPreventionHeaders({ userId: "acc_demo" });
  const ctx = (over: Partial<Parameters<typeof p.getObligations>[0]> = {}) => ({
    accountId: "acc_demo",
    accessToken: "at_seed",
    fraudHeaders: headers,
    ...over,
  });

  it("authorises via OAuth — no Government Gateway password anywhere", async () => {
    const url = p.getAuthorizationUrl({ accountId: "acc_demo", redirectUri: REDIRECT, state: "xyz" });
    expect(url).toMatch(/oauth\/authorize/);
    expect(url).toContain("state=xyz");
    expect(url).toContain("response_type=code");
    expect(url).not.toMatch(/password/i);
    const tokens = await p.exchangeCodeForTokens("auth-code-123", REDIRECT);
    expect(tokens.accessToken).toMatch(/^at_/);
    expect(tokens.refreshToken).toMatch(/^rt_/);
    expect(tokens.tokenType).toBe("bearer");
    expect(Date.parse(tokens.expiresAt)).toBeGreaterThan(Date.parse("2026-06-20T12:00:00Z"));
  });

  it("refreshes tokens and rejects a bad refresh token", async () => {
    const t = await p.refreshTokens("rt_abc");
    expect(t.accessToken).toMatch(/^at_/);
    await expect(p.refreshTokens("not-a-token")).rejects.toBeInstanceOf(HmrcApiError);
  });

  it("requires a bearer token and fraud-prevention headers", async () => {
    await expect(p.getObligations(ctx({ accessToken: "" }), "2026/27")).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(
      p.submitPeriodUpdate(ctx({ fraudHeaders: {} }), {
        obligationId: "ob_2627_q1", taxYear: "2026/27", period: "Q1", fromDate: "2026-04-06", toDate: "2026-07-05", totalIncomeMinor: 1000, totalExpensesMinor: 0,
      }),
    ).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
    expect(missingFraudHeaders({})).toEqual(REQUIRED_FRAUD_HEADERS);
    expect(missingFraudHeaders(headers)).toEqual([]);
  });

  it("full flow: authorise → list obligations → submit update → calculation", async () => {
    const tokens = await p.exchangeCodeForTokens("c", REDIRECT);
    const c = ctx({ accessToken: tokens.accessToken });

    const obligations = await p.getObligations(c, "2026/27");
    expect(obligations).toHaveLength(4);
    expect(obligations[0]).toMatchObject({ period: "Q1", startDate: "2026-04-06", endDate: "2026-07-05", dueDate: "2026-08-07" });

    const receipt = await p.submitPeriodUpdate(c, {
      obligationId: obligations[0].obligationId, taxYear: "2026/27", period: "Q1",
      fromDate: obligations[0].startDate, toDate: obligations[0].endDate,
      totalIncomeMinor: 320000, totalExpensesMinor: 50000,
    });
    expect(receipt.receiptRef).toMatch(/^HMRC-MTD-202627Q1-SE-/); // self, not agent
    expect(receipt.submittedAt).toBeTruthy();

    const calc = await p.getTaxCalculation(c, "2026/27", { totalIncomeMinor: 8_000_000, totalExpensesMinor: 1_000_000 });
    expect(calc.taxableProfitMinor).toBe(7_000_000);
    expect(calc.incomeTaxMinor).toBe(Math.round(0.2 * (7_000_000 - 1_257_000)));
    expect(calc.totalDueMinor).toBe(calc.incomeTaxMinor + calc.class4NicMinor);
    expect(calc.calculationId).toMatch(/^calc_202627_/);
  });

  it("supports delegated (agent) submission and the Final Declaration", async () => {
    const c = ctx({ agent: { onBehalfOfClient: true, agentReferenceNumber: "ARN-1" } });
    const r = await p.submitPeriodUpdate(c, {
      obligationId: "ob_2627_q1", taxYear: "2026/27", period: "Q1", fromDate: "2026-04-06", toDate: "2026-07-05", totalIncomeMinor: 1000, totalExpensesMinor: 0,
    });
    expect(r.receiptRef).toContain("-AG-"); // submitted on behalf of the client
    const fd = await p.submitFinalDeclaration(c, { taxYear: "2026/27", calculationId: "calc_x" });
    expect(fd.receiptRef).toMatch(/^HMRC-MTD-FINAL-202627-AG-/);
    await expect(p.submitFinalDeclaration(c, { taxYear: "2026/27", calculationId: "" })).rejects.toBeInstanceOf(HmrcApiError);
  });

  it("builds the required fraud-prevention headers without leaking credentials", () => {
    const h = buildFraudPreventionHeaders({ userId: "acc_demo" });
    for (const req of REQUIRED_FRAUD_HEADERS) expect(h[req]).toBeTruthy();
    expect(h["Gov-Client-Connection-Method"]).toBe("WEB_APP_VIA_SERVER");
    expect(JSON.stringify(h)).not.toMatch(/password/i);
  });
});

describe("data ingestion: bank feed", () => {
  it("a mock feed produces normalisable sample transactions", async () => {
    const provider = new MockBankFeedProvider();
    const { connectionId, consentExpiresAt } = await provider.connect("acc_1", "barclays");
    expect(consentExpiresAt > "2026-06-20").toBe(true); // consent has a future expiry
    const [account] = await provider.listAccounts(connectionId);
    const sample = await provider.fetchTransactions(account.externalId);
    expect(sample.length).toBeGreaterThan(0);

    const normalised = sample.map((s) => normalizeBankTransaction(s, "ba_new"));
    expect(normalised.every((t) => t.source === "bank_feed" && t.bankAccountId === "ba_new")).toBe(true);
    expect(normalised.some((t) => t.direction === "income")).toBe(true);
  });

  it("re-importing the same feed deduplicates", () => {
    const provider = new MockBankFeedProvider();
    return provider.fetchTransactions("ba_new_current").then((sample) => {
      const rows = sample.map((s) => normalizeBankTransaction(s, "ba_new"));
      const first = mergeDeduped(rows, []);
      expect(first.added).toBe(rows.length);
      const second = mergeDeduped(rows, first.merged); // same batch again
      expect(second.added).toBe(0);
      expect(second.duplicates).toBe(rows.length);
    });
  });
});

describe("data ingestion: CSV import", () => {
  const properties = getProperties().map((p) => ({ id: p.id, nickname: p.nickname }));
  const existing = getTransactions();

  it("the sample CSV imports with a validation summary (valid / duplicate / error)", () => {
    resetImportSeq();
    const { headers, rows } = parseCsv(SAMPLE_CSV);
    expect(headers[0].toLowerCase()).toBe("date");
    const map = autoMap(headers);
    expect(map.date).toBe(0);
    expect(map.amount).toBe(2);

    const { results, summary } = validateImport(rows, map, { existing, properties });
    expect(summary.total).toBe(6);
    expect(summary.valid).toBe(3);
    expect(summary.duplicates).toBe(1); // 2026-06-01 rent matches seeded data
    expect(summary.errors).toBe(2); // bad amount + unknown category

    // Row-level error reporting points at the offending field.
    const errorRows = results.filter((r) => r.status === "error");
    expect(errorRows.some((r) => r.errors.some((e) => e.field === "amount"))).toBe(true);
    expect(errorRows.some((r) => r.errors.some((e) => e.field === "category"))).toBe(true);

    // Valid rows are resolved into linked, categorised transactions.
    const ok = results.filter((r) => r.status === "ok").map((r) => r.transaction!);
    expect(ok.find((t) => t.description.includes("B&Q"))?.category).toBe("repairs_maintenance");
    expect(ok.find((t) => t.description.includes("insurance"))?.propertyId).toBe("p_station");
  });

  it("infers direction from amount sign when no direction column is mapped", () => {
    resetImportSeq();
    const csv = "Date,Description,Amount\n2026-06-25,Refund,-50.00\n2026-06-25,Credit,75.00";
    const { headers, rows } = parseCsv(csv);
    const { results } = validateImport(rows, autoMap(headers), { existing: [], properties });
    expect(results[0].transaction?.direction).toBe("expense");
    expect(results[1].transaction?.direction).toBe("income");
  });

  it("dedupeKey ignores description whitespace/case", () => {
    expect(dedupeKey({ date: "2026-06-01", amountPence: 1000, direction: "income", description: "Rent  J F" })).toBe(
      dedupeKey({ date: "2026-06-01", amountPence: 1000, direction: "income", description: "rent j f" }),
    );
  });
});

describe("notifications: triggers, planning & preferences", () => {
  const TODAY = "2026-06-21";

  it("isoDaysUntil counts whole days in either direction", () => {
    expect(isoDaysUntil(TODAY, "2026-06-28")).toBe(7);
    expect(isoDaysUntil(TODAY, "2026-06-22")).toBe(1);
    expect(isoDaysUntil(TODAY, "2026-06-21")).toBe(0);
    expect(isoDaysUntil(TODAY, "2026-06-14")).toBe(-7);
  });

  it("document expiry fires only on the 30/14/7/1-day thresholds", () => {
    const doc = (expiryDate: string) => ({ id: "d1", title: "Gas Safety Certificate", propertyName: "Oakfield Road", expiryDate });
    expect(documentExpiryEvents([doc("2026-06-28")], TODAY)).toHaveLength(1); // 7 days
    expect(documentExpiryEvents([doc("2026-07-01")], TODAY)).toHaveLength(0); // 10 days — no threshold
    expect(documentExpiryEvents([doc("2026-07-21")], TODAY)).toHaveLength(1); // 30 days
    const ev = documentExpiryEvents([doc("2026-06-28")], TODAY)[0];
    expect(ev.dedupeKey).toBe("doc:d1:expiry:7");
    expect(ev.category).toBe("document_expiry");
    expect(ev.title).toContain("7 days");
  });

  // The headline acceptance criterion.
  it("a document expiring in 7 days triggers exactly one reminder per configured channel; disabling a preference suppresses it", () => {
    const events = documentExpiryEvents(
      [{ id: "doc_oak_gas", title: "Gas Safety Certificate", propertyName: "Oakfield Road", expiryDate: "2026-06-28" }],
      TODAY,
    );
    expect(events).toHaveLength(1);

    // Default prefs: email + in-app on, push off → exactly two deliveries, one per channel.
    const planned = planDeliveries(events, DEFAULT_PREFERENCES);
    expect(planned).toHaveLength(2);
    expect(planned.map((p) => p.channel).sort()).toEqual(["email", "in_app"]);
    // Exactly one per channel — no channel appears twice.
    expect(new Set(planned.map((p) => p.channel)).size).toBe(planned.length);

    // Idempotent: re-running with those deliveries already recorded sends nothing.
    const ledger = planned.map((p) => deliveryKey(p.dedupeKey, p.channel));
    expect(planDeliveries(events, DEFAULT_PREFERENCES, ledger)).toHaveLength(0);

    // Disabling the email channel suppresses the email reminder (in-app remains).
    const noEmail = { ...DEFAULT_PREFERENCES, channels: { ...DEFAULT_PREFERENCES.channels, email: false } };
    expect(planDeliveries(events, noEmail).map((p) => p.channel)).toEqual(["in_app"]);

    // Disabling the whole document-expiry category suppresses every channel.
    const noCategory = {
      ...DEFAULT_PREFERENCES,
      categories: { ...DEFAULT_PREFERENCES.categories, document_expiry: false },
    };
    expect(planDeliveries(events, noCategory)).toHaveLength(0);

    // Enabling push as well fans out to all three channels — still exactly one each.
    const withPush = { ...DEFAULT_PREFERENCES, channels: { ...DEFAULT_PREFERENCES.channels, push: true } };
    const all = planDeliveries(events, withPush);
    expect(all.map((p) => p.channel).sort()).toEqual(["email", "in_app", "push"]);
  });

  it("planner collapses duplicate events within a single scan", () => {
    const dup = { dedupeKey: "doc:d1:expiry:7", category: "document_expiry" as const, title: "x", body: "y", href: "/files" };
    const planned = planDeliveries([dup, dup], DEFAULT_PREFERENCES);
    expect(planned).toHaveLength(2); // 1 unique event × 2 channels, not 4
  });

  it("arrears raise one alert per tenancy per month", () => {
    const rows = [{ tenancyId: "ten_station", propertyName: "Station Mews", tenantName: "Aisha Bennett", balanceMinor: 160000, monthsBehind: 1 }];
    const events = arrearsEvents(rows, TODAY);
    expect(events).toHaveLength(1);
    expect(events[0].dedupeKey).toBe("arrears:ten_station:2026-06");
    expect(events[0].category).toBe("arrears");
    // A zero/negative balance is not in arrears.
    expect(arrearsEvents([{ ...rows[0], balanceMinor: 0 }], TODAY)).toHaveLength(0);
  });

  it("upcoming rent reminders fire 3 and 1 day(s) before the due date", () => {
    const row = (dueDate: string) => ({ tenancyId: "ten_oak", propertyName: "Oakfield Road", dueDate, amountMinor: 125000 });
    expect(rentReminderEvents([row("2026-06-24")], TODAY)).toHaveLength(1); // 3 days
    expect(rentReminderEvents([row("2026-06-22")], TODAY)).toHaveLength(1); // 1 day
    expect(rentReminderEvents([row("2026-06-25")], TODAY)).toHaveLength(0); // 4 days — no threshold
    expect(rentReminderEvents([row("2026-06-24")], TODAY)[0].dedupeKey).toBe("rent:ten_oak:2026-06-24:3");
  });

  it("bank-feed alerts cover re-auth and consent expiry", () => {
    const reauth = bankFeedEvents([{ id: "ba_starling", bankName: "Starling", status: "needs_reauth" }], TODAY);
    expect(reauth).toHaveLength(1);
    expect(reauth[0].dedupeKey).toBe("bank:ba_starling:reauth:2026-06");

    const consent = bankFeedEvents(
      [{ id: "ba_barclays", bankName: "Barclays", status: "connected", consentExpiresAt: "2026-06-28" }],
      TODAY,
    );
    expect(consent).toHaveLength(1); // 7 days before consent expiry
    expect(consent[0].dedupeKey).toBe("bank:ba_barclays:consent:7");
    // A connected feed with far-off consent is quiet.
    expect(
      bankFeedEvents([{ id: "ba_barclays", bankName: "Barclays", status: "connected", consentExpiresAt: "2026-12-01" }], TODAY),
    ).toHaveLength(0);
  });

  it("MTD deadlines fire on the 30/14/7/1-day thresholds for open obligations", () => {
    const ob = (dueDate: string, status: "open" | "fulfilled") => ({ obligationId: "ob_2627_q1", taxYear: "2026/27", period: "Q1", dueDate, status });
    expect(mtdDeadlineEvents([ob("2026-07-21", "open")], TODAY)).toHaveLength(1); // 30 days
    expect(mtdDeadlineEvents([ob("2026-07-21", "fulfilled")], TODAY)).toHaveLength(0); // already filed
    expect(mtdDeadlineEvents([ob("2026-06-28", "open")], TODAY)[0].dedupeKey).toBe("mtd:ob_2627_q1:due:7");
  });

  it("collectNotificationEvents runs every trigger and honours a category filter", () => {
    const input = {
      documents: [{ id: "d1", title: "EICR", expiryDate: "2026-06-28" }],
      obligations: [{ obligationId: "o1", taxYear: "2026/27", period: "Q1", dueDate: "2026-06-28", status: "open" as const }],
    };
    const all = collectNotificationEvents(input, TODAY);
    expect(all.map((e) => e.category).sort()).toEqual(["document_expiry", "mtd_deadline"]);
    const onlyDocs = collectNotificationEvents(input, TODAY, ["document_expiry"]);
    expect(onlyDocs.every((e) => e.category === "document_expiry")).toBe(true);
  });
});

describe("trial & subscription model (entitlement + billing dates)", () => {
  const NOW = new Date("2026-06-21T12:00:00Z");
  const TRIAL_END = "2026-07-04T00:00:00.000Z";

  it("a trial account is NOT entitled and sees a countdown banner", () => {
    const v = subscriptionView({ status: "TRIALING", trialEndsAt: TRIAL_END, billingStartsAt: null }, NOW);
    expect(v.effectiveStatus).toBe("trialing");
    expect(v.entitled).toBe(false);
    expect(v.trialActive).toBe(true);
    expect(v.daysLeft).toBe(13); // 12.5 days → ceil
    expect(v.banner).toEqual({ kind: "trial", daysLeft: 13, trialEndsAt: TRIAL_END });
    // First charge is projected to the end of the trial.
    expect(v.firstChargeDate?.slice(0, 10)).toBe("2026-07-04");
  });

  it("scheduling a subscription during the trial unlocks access; billing is the trial-end date", () => {
    const v = subscriptionView({ status: "TRIALING", trialEndsAt: TRIAL_END, billingStartsAt: TRIAL_END }, NOW);
    expect(v.effectiveStatus).toBe("scheduled");
    expect(v.entitled).toBe(true); // overlays removed
    expect(v.firstChargeDate).toBe(TRIAL_END);
    expect(v.banner).toEqual({ kind: "scheduled", firstChargeDate: TRIAL_END });
    expect(formatChargeDate(v.firstChargeDate!)).toBe("4 July 2026"); // accurate messaging
  });

  it("once the billing date passes a scheduled subscription is active", () => {
    const later = new Date("2026-07-05T09:00:00Z");
    const v = subscriptionView({ status: "TRIALING", trialEndsAt: TRIAL_END, billingStartsAt: TRIAL_END }, later);
    expect(v.effectiveStatus).toBe("active");
    expect(v.entitled).toBe(true);
    expect(v.banner).toBeNull();
  });

  it("active accounts are entitled with no banner; past-due and canceled lose access", () => {
    const active = subscriptionView({ status: "ACTIVE", trialEndsAt: null, billingStartsAt: null }, NOW);
    expect(active.entitled).toBe(true);
    expect(active.banner).toBeNull();

    const pastDue = subscriptionView({ status: "PAST_DUE", trialEndsAt: null, billingStartsAt: null }, NOW);
    expect(pastDue.entitled).toBe(false);
    expect(pastDue.banner).toEqual({ kind: "past_due" });

    const canceled = subscriptionView({ status: "CANCELED", trialEndsAt: null, billingStartsAt: null }, NOW);
    expect(canceled.entitled).toBe(false);
  });

  it("an expired trial with no subscription is locked and prompts to subscribe", () => {
    const v = subscriptionView({ status: "TRIALING", trialEndsAt: "2026-06-01T00:00:00.000Z", billingStartsAt: null }, NOW);
    expect(v.effectiveStatus).toBe("trialing");
    expect(v.trialActive).toBe(false);
    expect(v.entitled).toBe(false);
    expect(v.banner).toEqual({ kind: "trial_ended" });
  });

  it("projectedFirstCharge is the trial end (or now if the trial already ended); plan price is £12/mo", () => {
    expect(projectedFirstCharge(TRIAL_END, NOW).toISOString()).toBe(TRIAL_END);
    expect(projectedFirstCharge("2026-06-01T00:00:00.000Z", NOW).toISOString()).toBe(NOW.toISOString());
    expect(trialEndFrom(NOW).toISOString()).toBe("2026-07-21T12:00:00.000Z"); // 30-day trial
    expect(planPriceLabel()).toBe("£12.00 / month");
  });
});

describe("encryption at rest", () => {
  it("round-trips a secret and stores it as opaque ciphertext", () => {
    const prev = process.env.ENCRYPTION_KEY;
    process.env.ENCRYPTION_KEY = "unit-test-key";
    try {
      const enc = encryptSecret("JBSWY3DPEHPK3PXP");
      expect(isEncrypted(enc)).toBe(true);
      expect(enc).not.toContain("JBSWY3DPEHPK3PXP"); // not plaintext
      expect(decryptSecret(enc)).toBe("JBSWY3DPEHPK3PXP");
    } finally {
      if (prev === undefined) delete process.env.ENCRYPTION_KEY;
      else process.env.ENCRYPTION_KEY = prev;
    }
  });

  it("falls back to tagged plaintext when no key is configured (and still decrypts)", () => {
    const prev = process.env.ENCRYPTION_KEY;
    delete process.env.ENCRYPTION_KEY;
    try {
      const enc = encryptSecret("x");
      expect(enc).toBe("plain:x");
      expect(isEncrypted(enc)).toBe(false);
      expect(decryptSecret(enc)).toBe("x");
    } finally {
      if (prev !== undefined) process.env.ENCRYPTION_KEY = prev;
    }
  });
});

// ---------------------------------------------------------------------------
// Integration checks — require a seeded Postgres (DATABASE_URL set).
// In CI these run against the postgres service; locally they run when a DB is up.
// ---------------------------------------------------------------------------

const hasDb = Boolean(process.env.DATABASE_URL);

const demoSession: AppSession = {
  user: { id: "user_demo", name: "Benjamin Walpole", email: "demo@landland.app", emailVerified: true },
  account: {
    id: "acc_demo",
    name: "Walpole Property Holdings",
    type: "portfolio",
    mtd: { enrolled: true, utr: "1234567890" },
    subscription: { status: "TRIALING", trialEndsAt: "2026-07-04T00:00:00.000Z", billingStartsAt: null },
  },
  role: "owner",
  isDelegated: false,
};

describe.skipIf(!hasDb)("integration: auth + multi-tenant scoping (Postgres)", () => {
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("the seeded demo account logs in", async () => {
    const result = await authenticate({ email: "demo@landland.app", password: "Password123!" });
    expect(result.activeAccountId).toBe("acc_demo");
  });

  it("rejects bad credentials", async () => {
    await expect(
      authenticate({ email: "demo@landland.app", password: "wrong-password" }),
    ).rejects.toBeInstanceOf(AuthError);
  });

  it("dashboard.summary is scoped to the session's account", async () => {
    const caller = appRouter.createCaller({ session: demoSession, prisma });
    const summary = await caller.dashboard.summary();
    expect(summary.propertyCount).toBe(3);
    expect(summary.occupiedCount).toBe(3);
    expect(summary.rentRollMinor).toBeGreaterThan(0); // non-zero dashboard figures
  });

  it("one account cannot see another account's data", async () => {
    const otherId = "acc_test_isolation";
    await prisma.account.upsert({
      where: { id: otherId },
      update: {},
      create: { id: otherId, name: "Other Landlord", type: "INDIVIDUAL" },
    });
    await prisma.property.deleteMany({ where: { accountId: otherId } });
    await prisma.portfolio.deleteMany({ where: { accountId: otherId } });
    const otherPortfolio = await prisma.portfolio.create({
      data: { accountId: otherId, name: "Personal — Default", type: "PERSONAL", isDefault: true },
    });
    await prisma.property.create({
      data: { accountId: otherId, portfolioId: otherPortfolio.id, nickname: "Solo flat", line1: "1 Test St", city: "Leeds", postcode: "LS1 1AA" },
    });

    try {
      const otherSession: AppSession = { ...demoSession, account: { ...demoSession.account, id: otherId } };
      const otherCaller = appRouter.createCaller({ session: otherSession, prisma });
      const demoCaller = appRouter.createCaller({ session: demoSession, prisma });

      expect((await otherCaller.dashboard.summary()).propertyCount).toBe(1);
      // The demo account is unaffected by the other account's data.
      expect((await demoCaller.dashboard.summary()).propertyCount).toBe(3);
    } finally {
      await prisma.account.delete({ where: { id: otherId } });
    }
  });

  it("protected procedures reject an unauthenticated context", async () => {
    const caller = appRouter.createCaller({ session: null, prisma });
    await expect(caller.dashboard.summary()).rejects.toThrow();
  });
});

// ---------------------------------------------------------------------------
// Profile / Settings + auth flows (acceptance criteria). Postgres-backed.
// ---------------------------------------------------------------------------

describe.skipIf(!hasDb)("profile, settings & auth flows (Postgres)", () => {
  // Each test creates and tears down its own throwaway account.
  async function makeUser(suffix: string): Promise<string> {
    const account = await prisma.account.create({ data: { name: `T ${suffix}`, type: "INDIVIDUAL" } });
    const user = await prisma.user.create({
      data: {
        accountId: account.id,
        email: `test-${suffix}@example.test`,
        firstName: "Test",
        lastName: "User",
        passwordHash: await hashPassword("Password123!"),
        emailVerified: new Date(),
        role: "OWNER",
      },
    });
    await prisma.membership.create({ data: { userId: user.id, accountId: account.id, role: "OWNER" } });
    return user.id;
  }
  async function destroy(userId: string) {
    const u = await prisma.user.findUnique({ where: { id: userId } });
    if (u) await prisma.account.delete({ where: { id: u.accountId } }).catch(() => {});
  }

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("updating profile persists", async () => {
    const userId = await makeUser("profile");
    try {
      const caller = appRouter.createCaller({ session: await ownerSession(userId), prisma });
      await caller.profile.update({ firstName: "Jamie", lastName: "Rivers", numberOfPropertiesManaged: 7 });

      const saved = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
      expect(saved.firstName).toBe("Jamie");
      expect(saved.lastName).toBe("Rivers");
      expect(saved.numberOfPropertiesManaged).toBe(7);
    } finally {
      await destroy(userId);
    }
  });

  it("enabling 2FA requires a verified code", async () => {
    const userId = await makeUser("twofa");
    try {
      const { secret } = await beginTotpEnrolment(userId);

      // A wrong code must be rejected and 2FA must stay disabled.
      await expect(confirmTotpEnrolment(userId, "000000")).rejects.toBeInstanceOf(TwoFactorError);
      expect((await prisma.user.findUniqueOrThrow({ where: { id: userId } })).twoFactorEnabled).toBe(false);

      // A valid code enables it.
      await confirmTotpEnrolment(userId, authenticator.generate(secret));
      expect((await prisma.user.findUniqueOrThrow({ where: { id: userId } })).twoFactorEnabled).toBe(true);
    } finally {
      await destroy(userId);
    }
  });

  it("settings updates persist (timezone, first tax year, preferences)", async () => {
    const userId = await makeUser("settings");
    try {
      const caller = appRouter.createCaller({ session: await ownerSession(userId), prisma });
      await caller.settings.update({
        timeZone: "America/New_York",
        firstTaxYear: "2018/19",
        marketingEmails: true,
      });
      const acct = await prisma.user
        .findUniqueOrThrow({ where: { id: userId } })
        .then((u) => prisma.account.findUniqueOrThrow({ where: { id: u.accountId } }));
      expect(acct.timeZone).toBe("America/New_York");
      expect(acct.firstTaxYear).toBe("2018/19");
      expect(acct.marketingEmails).toBe(true);
    } finally {
      await destroy(userId);
    }
  });

  it("accepting an invitation grants delegated access", async () => {
    const ownerId = await makeUser("inviter");
    const owner = await prisma.user.findUniqueOrThrow({ where: { id: ownerId } });
    const inviteeEmail = "invited-accountant@example.test";
    let inviteeUserId: string | null = null;
    try {
      // Hand-insert an invitation with a known token (createInvitation emails the token).
      await prisma.invitation.create({
        data: {
          accountId: owner.accountId,
          invitedById: ownerId,
          email: inviteeEmail,
          role: "ACCOUNTANT",
          hashedToken: hashToken("raw-invite-token"),
          expiresAt: new Date(Date.now() + 60_000),
        },
      });

      const { userId, activeAccountId } = await acceptInvitation({
        token: "raw-invite-token",
        firstName: "Priya",
        lastName: "Anand",
        password: "Password123!",
      });
      inviteeUserId = userId;

      expect(activeAccountId).toBe(owner.accountId);
      const membership = await prisma.membership.findUniqueOrThrow({
        where: { userId_accountId: { userId, accountId: owner.accountId } },
      });
      expect(membership.delegated).toBe(true);
      expect(membership.role).toBe("ACCOUNTANT");
    } finally {
      // Invitee got their own home account too — remove both.
      if (inviteeUserId) {
        const invitee = await prisma.user.findUnique({ where: { id: inviteeUserId } });
        if (invitee) await prisma.account.delete({ where: { id: invitee.accountId } }).catch(() => {});
      }
      await destroy(ownerId);
    }
  });
});

// ---------------------------------------------------------------------------
// Notifications end-to-end (Postgres): the scan → dispatch → ledger pipeline.
// ---------------------------------------------------------------------------

describe.skipIf(!hasDb)("notification scan & dispatch (Postgres)", () => {
  afterAll(async () => {
    await prisma.$disconnect();
  });

  async function makeAccount(suffix: string): Promise<string> {
    const account = await prisma.account.create({ data: { name: `N ${suffix}`, type: "INDIVIDUAL", timeZone: "Europe/London" } });
    await prisma.user.create({
      data: {
        accountId: account.id,
        email: `notif-${suffix}@example.test`,
        firstName: "Owner",
        lastName: "User",
        passwordHash: await hashPassword("Password123!"),
        emailVerified: new Date(),
        role: "OWNER",
      },
    });
    return account.id;
  }

  /** A date `days` from the account-local today, as a UTC-midnight Date. */
  function inDays(days: number): Date {
    const todayMs = new Date(`${todayInZone("Europe/London")}T00:00:00Z`).getTime();
    return new Date(todayMs + days * 86_400_000);
  }

  // The headline acceptance criterion, exercised against the real database.
  it("a document expiring in 7 days creates exactly one notification per configured channel, and re-running sends nothing more", async () => {
    const accountId = await makeAccount("doc7");
    try {
      const doc = await prisma.document.create({
        data: { accountId, category: "GAS_SAFETY", title: "Gas Safety Certificate", storageKey: "k", expiryDate: inDays(7) },
      });
      const dedupeKey = `doc:${doc.id}:expiry:7`;

      // Default preferences: email + in-app on, push off.
      const first = await runNotificationScan(accountId, { categories: ["document_expiry"] });
      expect(first.created).toBe(2);

      const rows = await prisma.notification.findMany({ where: { accountId, dedupeKey } });
      expect(rows.map((r) => r.channel).sort()).toEqual(["EMAIL", "IN_APP"]);
      // Exactly one row per channel.
      expect(new Set(rows.map((r) => r.channel)).size).toBe(rows.length);

      // Re-running is idempotent — no duplicate deliveries.
      const second = await runNotificationScan(accountId, { categories: ["document_expiry"] });
      expect(second.created).toBe(0);
      expect(await prisma.notification.count({ where: { accountId, dedupeKey } })).toBe(2);
    } finally {
      await prisma.account.delete({ where: { id: accountId } });
    }
  });

  it("disabling the email channel suppresses the email reminder (in-app still delivered)", async () => {
    const accountId = await makeAccount("noemail");
    try {
      await savePreferences(prisma, accountId, {
        channels: { email: false, in_app: true, push: false },
        categories: { document_expiry: true, arrears: true, rent_reminder: true, bank_feed: true, mtd_deadline: true },
        marketingEmails: false,
      });
      const doc = await prisma.document.create({
        data: { accountId, category: "EICR", title: "EICR", storageKey: "k", expiryDate: inDays(14) },
      });
      const dedupeKey = `doc:${doc.id}:expiry:14`;

      const summary = await runNotificationScan(accountId, { categories: ["document_expiry"] });
      expect(summary.created).toBe(1);

      const rows = await prisma.notification.findMany({ where: { accountId, dedupeKey } });
      expect(rows.map((r) => r.channel)).toEqual(["IN_APP"]); // email suppressed
    } finally {
      await prisma.account.delete({ where: { id: accountId } });
    }
  });
});

// ---------------------------------------------------------------------------
// Audit trail & GDPR paths (Postgres).
// ---------------------------------------------------------------------------

describe.skipIf(!hasDb)("audit trail & GDPR (Postgres)", () => {
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("records & lists audit entries, exports data with secrets redacted, and erases on delete", async () => {
    const account = await prisma.account.create({ data: { name: "Audit Co", type: "INDIVIDUAL" } });
    const user = await prisma.user.create({
      data: {
        accountId: account.id,
        email: "audit-user@example.test",
        firstName: "Aud",
        lastName: "Itor",
        passwordHash: await hashPassword("Password123!"),
        emailVerified: new Date(),
        role: "OWNER",
        totpSecret: "totp-secret-value",
      },
    });
    let deleted = false;
    try {
      // Audit a financial/external event.
      await recordAudit({ accountId: account.id, actorUserId: user.id, action: "SUBMIT", entity: "mtd_submission", summary: "Submitted Q1 update" });
      const log = await listAudit(prisma, account.id);
      expect(log.some((e) => e.action === "SUBMIT" && e.summary.includes("Q1"))).toBe(true);

      // Data export includes the account but redacts secrets, and is itself audited.
      const data = await exportAccountData(prisma, account.id);
      expect((data.account as { id: string }).id).toBe(account.id);
      const exportedUser = (data.users as Array<Record<string, unknown>>)[0];
      expect(exportedUser.passwordHash).toBeUndefined();
      expect(exportedUser.totpSecret).toBeUndefined();
      expect((await listAudit(prisma, account.id)).some((e) => e.action === "EXPORT")).toBe(true);

      // Erasure cascades to the account's users.
      await deleteAccount(prisma, account.id, user.id);
      deleted = true;
      expect(await prisma.account.findUnique({ where: { id: account.id } })).toBeNull();
      expect(await prisma.user.findUnique({ where: { id: user.id } })).toBeNull();
    } finally {
      if (!deleted) await prisma.account.delete({ where: { id: account.id } }).catch(() => {});
    }
  });
});

// ---------------------------------------------------------------------------
// Billing / subscription activation (Postgres): the acceptance flow.
// ---------------------------------------------------------------------------

describe.skipIf(!hasDb)("subscription activation & gating (Postgres)", () => {
  afterAll(async () => {
    await prisma.$disconnect();
  });

  // The headline acceptance criterion: trial → gated; activating → ungated;
  // billing-date messaging accurate.
  it("a trial account is gated; completing checkout entitles it and schedules billing for the trial-end date", async () => {
    // Trial ends in the future relative to the pinned clock (2026-06-20).
    const account = await prisma.account.create({
      data: { name: "Billing Co", type: "INDIVIDUAL", subscriptionStatus: "TRIALING", trialEndsAt: new Date("2026-07-04T00:00:00Z") },
    });
    await prisma.user.create({
      data: {
        accountId: account.id,
        email: "billing-owner@example.test",
        firstName: "Owner",
        lastName: "User",
        passwordHash: await hashPassword("Password123!"),
        emailVerified: new Date(),
        role: "OWNER",
      },
    });

    try {
      // Before: on trial, NOT entitled → gated overlays show.
      expect(viewForAccount(account).entitled).toBe(false);

      const provider = new MockPaymentProvider();
      const checkout = await provider.createCheckout({
        accountId: account.id,
        customerEmail: "billing-owner@example.test",
        returnUrl: "/settings?subscribed=1",
        trialEndsAt: account.trialEndsAt!.toISOString(),
      });
      // The hosted URL points at the provider's checkout, not an internal data route.
      expect(checkout.url).toContain("/billing/checkout");

      // Terms must not be auto-accepted — completing without them is rejected.
      await expect(
        completeCheckout(prisma, provider, account.id, { sessionId: checkout.id, termsAccepted: false }),
      ).rejects.toMatchObject({ code: "TERMS_REQUIRED" });

      // Completing with explicit terms acceptance entitles the account.
      const view = await completeCheckout(prisma, provider, account.id, { sessionId: checkout.id, termsAccepted: true });
      expect(view.entitled).toBe(true); // overlays removed
      expect(view.effectiveStatus).toBe("scheduled");
      expect(view.firstChargeDate?.slice(0, 10)).toBe("2026-07-04");
      expect(formatChargeDate(view.firstChargeDate!)).toBe("4 July 2026"); // accurate billing date

      // Persisted: card summary (display-only), terms timestamp, scheduled billing.
      const saved = await prisma.account.findUniqueOrThrow({ where: { id: account.id } });
      expect(saved.paymentMethodBrand).toBe("Visa");
      expect(saved.paymentMethodLast4).toBe("4242");
      expect(saved.termsAcceptedAt).not.toBeNull();
      expect(saved.billingStartsAt?.toISOString()).toBe("2026-07-04T00:00:00.000Z");
      expect(saved.subscriptionStatus).toBe("TRIALING"); // not charged yet, but entitled
      expect(viewForAccount(saved).entitled).toBe(true);
    } finally {
      await prisma.account.delete({ where: { id: account.id } });
    }
  });
});

// ---------------------------------------------------------------------------
// Documents / evidence (Postgres + in-memory StoragePort, no network): the full
// upload path and CLAIM SEPARATION — a proposed expiry is not authoritative
// until confirmed.
// ---------------------------------------------------------------------------

describe.skipIf(!hasDb)("documents: storage upload + claim separation (Postgres)", () => {
  afterAll(async () => {
    await prisma.$disconnect();
  });

  const inScope: EngineProfile = {
    hasGasSupply: true,
    annualRentGBP: 12_000,
    tenantIsIndividual: true,
    tenantOnlyOrMainHome: true,
    landlordResident: false,
  };

  function gasStatus(accountId: string, propertyId: string, evidence: Awaited<ReturnType<typeof confirmedEngineEvidence>>) {
    const out = evaluateObligations({ id: propertyId, jurisdiction: "england", evidence }, inScope, UK_RULES, "2026-06-20");
    const gas = out.find((o) => o.ruleId === "gas-safety");
    if (!gas) throw new Error("no gas obligation");
    return gas;
  }

  it("uploads via StoragePort with an owner-namespaced key; a proposed expiry is NOT authoritative until confirmed", async () => {
    const account = await prisma.account.create({ data: { name: "Docs Co", type: "INDIVIDUAL" } });
    const propertyId = "p_docs_test";
    const storage = new InMemoryStoragePort();
    try {
      // --- Upload (full path, no network) ---
      const up = await uploadEvidence(prisma, storage, {
        accountId: account.id,
        ownerId: account.id,
        propertyId,
        kind: "GAS_SAFETY",
        filename: "CP12.pdf",
        contentType: "application/pdf",
        body: "PDF-BYTES",
        proposedExpiresOn: "2027-01-01", // a PROPOSAL only
      });

      // Stored under the owner-namespaced key (leading segment = owner id for RLS).
      expect(ownerOf(up.storageKey)).toBe(account.id);
      expect(up.storageKey).toBe(`${account.id}/${propertyId}/${up.id}/CP12.pdf`);
      expect(storage.has(up.storageKey)).toBe(true);

      // A signed URL is produced from the in-memory adapter.
      const list = await listEvidence(prisma, storage, { accountId: account.id, propertyId });
      expect(list).toHaveLength(1);
      expect(list[0]!.signedUrl).toContain("memory://signed/");
      expect(list[0]!.confirmed).toBe(false);
      expect(list[0]!.proposedExpiresOn).toBe("2027-01-01");
      expect(list[0]!.expiresOn).toBeNull(); // not authoritative

      // The engine does NOT see the proposed expiry → gas is overdue, not compliant.
      const before = await confirmedEngineEvidence(prisma, account.id, propertyId);
      expect(before).toHaveLength(0);
      const gasBefore = gasStatus(account.id, propertyId, before);
      expect(gasBefore.status).toBe("overdue");
      expect(gasBefore.dueDate).toBeNull();

      // --- Confirm → the proposal becomes the authoritative fact the engine reads ---
      await confirmExpiry(prisma, { accountId: account.id, evidenceId: up.id, expiresOn: "2027-01-01" });
      const after = await confirmedEngineEvidence(prisma, account.id, propertyId);
      expect(after).toHaveLength(1);
      const gasAfter = gasStatus(account.id, propertyId, after);
      expect(gasAfter.status).toBe("compliant");
      expect(gasAfter.dueDate).toBe("2027-01-01"); // confirmed expiry is now the deadline
      expect(gasAfter.evidenceIds).toContain(up.id);
    } finally {
      await prisma.account.delete({ where: { id: account.id } });
    }
  });
});

// ---------------------------------------------------------------------------
// Safety certificates (Postgres): the gas next-due shown in the UI (read from
// evaluateProperty, the same call the Safety page makes) must equal the engine's
// nextGasDue across the grace-window edge cases.
// ---------------------------------------------------------------------------

describe.skipIf(!hasDb)("safety: gas next-due matches the engine across grace-window edges (Postgres)", () => {
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("evaluateProperty's gas dueDate === nextGasDue for preserve / boundary / reset / late", async () => {
    const account = await prisma.account.create({ data: { name: "Safety Co", type: "INDIVIDUAL" } });
    const propertyId = "p_safety_test";
    const storage = new InMemoryStoragePort();
    try {
      // In-scope, gas-supplied → the gas obligation applies.
      await prisma.applicabilityProfile.create({
        data: {
          accountId: account.id,
          propertyId,
          hasGasSupply: true,
          annualRentGBP: 12_000,
          tenantIsIndividual: true,
          tenantOnlyOrMainHome: true,
          landlordResident: false,
        },
      });

      const anniversary = "2025-07-30"; // grace window starts 2025-05-30
      const cases = [
        { inspectionDate: "2025-06-15", expected: "2026-07-30" }, // within window → preserved
        { inspectionDate: "2025-05-30", expected: "2026-07-30" }, // boundary (window start) → preserved
        { inspectionDate: "2025-05-29", expected: "2026-05-29" }, // one day earlier → reset
        { inspectionDate: "2025-08-05", expected: "2026-08-05" }, // after anniversary → late re-anchor
      ];

      for (const c of cases) {
        await prisma.evidence.deleteMany({ where: { accountId: account.id, propertyId } });
        const up = await uploadEvidence(prisma, storage, {
          accountId: account.id,
          ownerId: account.id,
          propertyId,
          kind: "GAS_SAFETY",
          filename: "CP12.pdf",
          contentType: "application/pdf",
          body: "PDF",
        });
        // Capture BOTH dates and feed the anniversary-preserving calculation.
        await confirmGasInspection(prisma, { accountId: account.id, evidenceId: up.id, inspectionDate: c.inspectionDate, anniversary });

        // The Safety page reads dueDate straight from this evaluation.
        const { evaluation } = await evaluateProperty(prisma, account.id, propertyId);
        const gas = evaluation.find((o) => o.ruleId === "gas-safety");
        if (!gas) throw new Error("no gas obligation");

        // The shown next-due equals the engine's pure nextGasDue, and the expected anchor.
        expect(gas.dueDate).toBe(nextGasDue(c.inspectionDate, anniversary));
        expect(gas.dueDate).toBe(c.expected);
        // And the WHY is the engine's plain-language explanation.
        expect(gas.basis.summary.length).toBeGreaterThan(0);
      }
    } finally {
      await prisma.account.delete({ where: { id: account.id } });
    }
  });
});

// ---------------------------------------------------------------------------
// Deposit & tenancy obligations (Postgres): a missing prescribed-information
// record and an unprotected deposit each resolve to the correct non-compliant
// status via evaluateProperty (the call the Deposit/Tenancy pages make).
// ---------------------------------------------------------------------------

describe.skipIf(!hasDb)("deposit & tenancy non-compliance (Postgres)", () => {
  afterAll(async () => {
    await prisma.$disconnect();
  });

  async function inScopeAccount(suffix: string): Promise<{ accountId: string; propertyId: string }> {
    const account = await prisma.account.create({ data: { name: `Compliance ${suffix}`, type: "INDIVIDUAL" } });
    const propertyId = `p_${suffix}`;
    await prisma.applicabilityProfile.create({
      data: { accountId: account.id, propertyId, annualRentGBP: 12_000, tenantIsIndividual: true, tenantOnlyOrMainHome: true, landlordResident: false },
    });
    return { accountId: account.id, propertyId };
  }

  it("an unprotected deposit and missing prescribed information each resolve to non-compliant (blocking possession)", async () => {
    const { accountId, propertyId } = await inScopeAccount("deposit");
    try {
      // Received long ago, never protected, prescribed information never served.
      await saveDeposit(prisma, accountId, propertyId, {
        scheme: null,
        depositGBP: 1_500,
        receivedOn: "2026-01-01",
        protectedOn: null,
        prescribedInfoServedOn: null,
      });

      const before = (await evaluateProperty(prisma, accountId, propertyId)).evaluation;
      const protection = before.find((o) => o.ruleId === "deposit-protection");
      const prescribed = before.find((o) => o.ruleId === "deposit-prescribed-information");
      if (!protection || !prescribed) throw new Error("missing deposit obligations");

      expect(protection.status).toBe("overdue");
      expect(protection.status).not.toBe("compliant");
      expect(protection.blocksPossession).toBe(true);
      expect(protection.dueDate).toBe("2026-01-31");

      expect(prescribed.status).toBe("overdue");
      expect(prescribed.blocksPossession).toBe(true);

      // Protecting + serving within 30 days clears both.
      await saveDeposit(prisma, accountId, propertyId, {
        scheme: "tds",
        depositGBP: 1_500,
        receivedOn: "2026-01-01",
        protectedOn: "2026-01-10",
        prescribedInfoServedOn: "2026-01-15",
      });
      const after = (await evaluateProperty(prisma, accountId, propertyId)).evaluation;
      expect(after.find((o) => o.ruleId === "deposit-protection")!.status).toBe("compliant");
      expect(after.find((o) => o.ruleId === "deposit-prescribed-information")!.status).toBe("compliant");
    } finally {
      await prisma.account.delete({ where: { id: accountId } });
    }
  });

  it("written terms not provided within 28 days of tenancy start is non-compliant", async () => {
    const { accountId, propertyId } = await inScopeAccount("tenancy");
    try {
      await saveCurrentTenancy(prisma, accountId, propertyId, {
        kind: "PERIODIC_ASSURED",
        startDate: "2026-01-01",
        writtenTermsProvidedOn: null,
        informationProvidedOn: null,
      });
      const obligations = (await evaluateProperty(prisma, accountId, propertyId)).evaluation;
      expect(obligations.find((o) => o.ruleId === "tenancy-written-terms")!.status).toBe("overdue");
      expect(obligations.find((o) => o.ruleId === "tenancy-information-provision")!.status).toBe("overdue");
    } finally {
      await prisma.account.delete({ where: { id: accountId } });
    }
  });
});

// ---------------------------------------------------------------------------
// Rent arrears (Postgres): the schedule-vs-confirmed-receipts ledger through
// assessRentForProperty (the call the Rent page makes), including the Section 8
// Ground 8 threshold at both stages and claim separation (confirmed-only).
// ---------------------------------------------------------------------------

describe.skipIf(!hasDb)("rent arrears & Section 8 Ground 8 (Postgres)", () => {
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("monthly: threshold met at both stages → Ground 8 available; unconfirmed receipts ignored", async () => {
    const account = await prisma.account.create({ data: { name: "Rent Co", type: "INDIVIDUAL" } });
    const propertyId = "p_rent_test";
    try {
      await saveSchedule(prisma, account.id, propertyId, { frequency: "MONTHLY", rentGBP: 1000, startDate: "2026-01-01", endDate: null });
      // An UNCONFIRMED bank-feed receipt that would clear arrears if it counted.
      await prisma.rentReceipt.create({
        data: { accountId: account.id, propertyId, date: new Date("2026-02-01"), amountGBP: 3000, source: "BANK_FEED", confirmed: false },
      });

      const before = (await assessRentForProperty(prisma, account.id, propertyId, { asOf: "2026-04-01", noticeDate: "2026-03-01", hearingDate: "2026-04-01" })).assessment;
      if (!before) throw new Error("no assessment");
      expect(before.current.received).toBe(0); // unconfirmed ignored (claim separation)
      expect(before.notice!.thresholdMet).toBe(true); // £3,000 at notice
      expect(before.hearing!.thresholdMet).toBe(true); // £4,000 at hearing
      expect(before.ground8Available).toBe(true);
      expect(before.status).toBe("overdue");

      // A confirmed manual payment that drops it below by the hearing.
      await addManualReceipt(prisma, account.id, propertyId, { date: "2026-03-15", amountGBP: 1500, reference: null });
      const after = (await assessRentForProperty(prisma, account.id, propertyId, { asOf: "2026-04-01", noticeDate: "2026-03-01", hearingDate: "2026-04-01" })).assessment!;
      expect(after.notice!.thresholdMet).toBe(true);
      expect(after.hearing!.thresholdMet).toBe(false); // £4,000 − £1,500 = £2,500 < £3,000
      expect(after.ground8Available).toBe(false);
    } finally {
      await prisma.account.delete({ where: { id: account.id } });
    }
  });

  it("weekly: exactly 13 weeks' arrears meets the £2,600 threshold", async () => {
    const account = await prisma.account.create({ data: { name: "Rent Wk", type: "INDIVIDUAL" } });
    const propertyId = "p_rent_wk";
    try {
      await saveSchedule(prisma, account.id, propertyId, { frequency: "WEEKLY", rentGBP: 200, startDate: "2026-01-01", endDate: null });
      const a = (await assessRentForProperty(prisma, account.id, propertyId, { asOf: "2026-03-26" })).assessment!;
      expect(a.thresholdAmount).toBe(2600);
      expect(a.current.arrears).toBe(2600);
      expect(a.current.thresholdMet).toBe(true);
      expect(a.status).toBe("overdue");
    } finally {
      await prisma.account.delete({ where: { id: account.id } });
    }
  });
});

// ---------------------------------------------------------------------------
// Licensing & Activity (Postgres): a lapsed licence resolves to overdue, and
// the Activity log is append-only (rejects updates/deletes).
// ---------------------------------------------------------------------------

describe.skipIf(!hasDb)("licensing & append-only activity (Postgres)", () => {
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("a lapsed HMO licence resolves to overdue (via evaluateProperty)", async () => {
    const account = await prisma.account.create({ data: { name: "Licence Co", type: "INDIVIDUAL" } });
    const propertyId = "p_licence_test";
    try {
      // In-scope + HMO test passes (5 occupants / 2 households) → hmo-licence applies.
      await prisma.applicabilityProfile.create({
        data: { accountId: account.id, propertyId, occupants: 5, households: 2, annualRentGBP: 12_000, tenantIsIndividual: true, tenantOnlyOrMainHome: true, landlordResident: false },
      });
      await addLicence(prisma, account.id, propertyId, { type: "HMO", reference: "LIC-1", grantedOn: "2021-01-01", expiresOn: "2026-01-01" }); // lapsed (asOf 2026-06-20)

      const { evaluation } = await evaluateProperty(prisma, account.id, propertyId);
      const hmo = evaluation.find((o) => o.ruleId === "hmo-licence");
      if (!hmo) throw new Error("no hmo-licence obligation");
      expect(hmo.status).toBe("overdue");
      expect(hmo.dueDate).toBe("2026-01-01");

      // A current licence flips it back to compliant.
      await addLicence(prisma, account.id, propertyId, { type: "HMO", reference: "LIC-2", grantedOn: "2025-06-01", expiresOn: "2030-06-01" });
      const after = (await evaluateProperty(prisma, account.id, propertyId)).evaluation.find((o) => o.ruleId === "hmo-licence")!;
      expect(after.status).toBe("compliant");
    } finally {
      await prisma.account.delete({ where: { id: account.id } });
    }
  });

  it("the Activity log rejects updates and deletes (append-only; a correction is a new row)", async () => {
    const accountId = "acc_activity_appendonly_test";
    await appendActivity(prisma, { accountId, propertyId: "p_x", action: "CREATE", entity: "licence", summary: "original entry" });
    const row = await prisma.activityLog.findFirst({ where: { accountId }, orderBy: { createdAt: "desc" } });
    expect(row).toBeTruthy();

    // The DB trigger forbids UPDATE and DELETE.
    await expect(prisma.activityLog.update({ where: { id: row!.id }, data: { summary: "edited" } })).rejects.toThrow();
    await expect(prisma.activityLog.delete({ where: { id: row!.id } })).rejects.toThrow();

    // The original row is intact and unchanged.
    const reread = await prisma.activityLog.findUnique({ where: { id: row!.id } });
    expect(reread?.summary).toBe("original entry");

    // A correction is appended as a NEW row (never an edit) — idempotent check.
    const before = await prisma.activityLog.count({ where: { accountId } });
    await appendActivity(prisma, { accountId, propertyId: "p_x", action: "CORRECTION", entity: "activity", summary: "corrects the above", isCorrection: true, correctsId: row!.id });
    const after = await prisma.activityLog.count({ where: { accountId } });
    expect(after).toBe(before + 1);
  });
});
