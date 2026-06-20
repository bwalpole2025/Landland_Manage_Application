import { describe, it, expect, afterAll } from "vitest";
import { authenticator } from "otplib";

import { formatGBP, poundsToPence } from "@/lib/money";
import { generateTotpSecret, verifyTotp } from "@/server/auth/totp";
import { hashPassword, verifyPassword } from "@/server/auth/password";
import { authenticate, AuthError } from "@/server/auth/service";
import { appRouter } from "@/server/routers/_app";
import { prisma } from "@/server/db";
import type { AppSession } from "@/server/auth/session";

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

// ---------------------------------------------------------------------------
// Integration checks — require a seeded Postgres (DATABASE_URL set).
// In CI these run against the postgres service; locally they run when a DB is up.
// ---------------------------------------------------------------------------

const hasDb = Boolean(process.env.DATABASE_URL);

const demoSession: AppSession = {
  user: { id: "user_demo", name: "Benjamin Walpole", email: "demo@landland.app" },
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
