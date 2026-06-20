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
import { suggestCategorisation, type SuggestContext } from "@/lib/categorisation";
import type { Transaction } from "@/lib/types";
import { getPropertiesSummary, getPropertyFigures, getPropertyPnl12m, recentTaxYears } from "@/lib/properties";
import { getOwnerSplit, getBeneficialOwners, getPortfolioOwnership, ownerShareOfProperty } from "@/lib/ownership";
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
import { normalizeBankTransaction, mergeDeduped, dedupeKey } from "@/lib/ingest";
import { parseCsv, autoMap, validateImport, SAMPLE_CSV, resetImportSeq } from "@/lib/import/csv";
import { acceptInvitation } from "@/server/auth/invitations";
import { hashToken } from "@/server/auth/tokens";
import { appRouter } from "@/server/routers/_app";
import { prisma } from "@/server/db";
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
      subscription: { status: "TRIALING", trialEndsAt: null },
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
    subscription: { status: "TRIALING", trialEndsAt: "2026-07-04T00:00:00.000Z" },
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
