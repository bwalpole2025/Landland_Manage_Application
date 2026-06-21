// Reads an account's domain data from Prisma and shapes it into the plain
// TriggerInput consumed by the pure triggers. Arrears and upcoming-rent figures
// are computed here against the account-local `today` so the day-boundary math
// respects the account time zone.

import type { PrismaClient } from "@prisma/client";
import type {
  ArrearsInput,
  BankFeedInput,
  DocumentExpiryInput,
  MtdDeadlineInput,
  RentReminderInput,
  TriggerInput,
} from "@/lib/notifications";

const ARREARS_WINDOW_MONTHS = 3;

function isoDate(d: Date | null | undefined): string | undefined {
  return d ? d.toISOString().slice(0, 10) : undefined;
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function daysInMonth(year: number, month1: number): number {
  return new Date(Date.UTC(year, month1, 0)).getUTCDate();
}

/** The next occurrence of `dueDay` on or after `today` (ISO "YYYY-MM-DD"). */
export function nextMonthlyDue(today: string, dueDay: number): string {
  let [year, month] = today.split("-").map(Number); // month is 1-based
  const at = (y: number, m: number) => `${y}-${pad(m)}-${pad(Math.min(dueDay, daysInMonth(y, m)))}`;
  let candidate = at(year, month);
  if (candidate < today) {
    month += 1;
    if (month > 12) {
      month = 1;
      year += 1;
    }
    candidate = at(year, month);
  }
  return candidate;
}

export async function gatherTriggerInput(
  prisma: PrismaClient,
  accountId: string,
  today: string,
): Promise<TriggerInput> {
  const [documents, tenancies, bankAccounts, obligations] = await Promise.all([
    prisma.document.findMany({
      where: { accountId, expiryDate: { not: null } },
      select: { id: true, title: true, expiryDate: true, property: { select: { nickname: true } } },
    }),
    prisma.tenancy.findMany({
      where: { accountId, status: "ACTIVE", deletedAt: null },
      select: {
        id: true,
        rentMinor: true,
        rentDueDay: true,
        rentFrequency: true,
        nextPaymentDate: true,
        tenantName: true,
        property: { select: { nickname: true } },
      },
    }),
    prisma.bankAccount.findMany({
      where: { accountId },
      select: {
        id: true,
        bankName: true,
        accountName: true,
        status: true,
        consentExpiresAt: true,
      },
    }),
    prisma.mtdObligation.findMany({
      where: { accountId, status: "OPEN" },
      select: { id: true, taxYear: true, period: true, dueDate: true },
    }),
  ]);

  const documentInputs: DocumentExpiryInput[] = documents.map((d) => ({
    id: d.id,
    title: d.title,
    propertyName: d.property?.nickname,
    expiryDate: isoDate(d.expiryDate),
  }));

  // Arrears: expected rent over a rolling window vs rent actually received.
  const now = new Date(`${today}T00:00:00Z`);
  const windowStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (ARREARS_WINDOW_MONTHS - 1), 1));
  const arrears: ArrearsInput[] = [];
  const upcomingRent: RentReminderInput[] = [];

  for (const t of tenancies) {
    const propertyName = t.property?.nickname ?? "Property";

    const received = await prisma.transaction.aggregate({
      where: { tenancyId: t.id, direction: "INCOME", category: "RENT", date: { gte: windowStart } },
      _sum: { amountMinor: true },
    });
    let dueMonths = 0;
    for (let i = 0; i < ARREARS_WINDOW_MONTHS; i++) {
      const due = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, t.rentDueDay));
      if (due.getTime() <= now.getTime() && due.getTime() >= windowStart.getTime()) dueMonths += 1;
    }
    const balance = dueMonths * t.rentMinor - (received._sum.amountMinor ?? 0);
    if (balance >= t.rentMinor / 2) {
      arrears.push({
        tenancyId: t.id,
        propertyName,
        tenantName: t.tenantName ?? undefined,
        balanceMinor: balance,
        monthsBehind: Math.max(1, Math.round(balance / t.rentMinor)),
      });
    }

    // Upcoming rent: next monthly due (or the stored nextPaymentDate otherwise).
    const dueDate =
      t.rentFrequency === "MONTHLY"
        ? nextMonthlyDue(today, t.rentDueDay)
        : isoDate(t.nextPaymentDate);
    if (dueDate) {
      upcomingRent.push({
        tenancyId: t.id,
        propertyName,
        tenantName: t.tenantName ?? undefined,
        dueDate,
        amountMinor: t.rentMinor,
      });
    }
  }

  const bankInputs: BankFeedInput[] = bankAccounts.map((b) => ({
    id: b.id,
    bankName: b.bankName,
    accountName: b.accountName,
    status: b.status === "CONNECTED" ? "connected" : b.status === "NEEDS_REAUTH" ? "needs_reauth" : "disconnected",
    consentExpiresAt: isoDate(b.consentExpiresAt),
  }));

  const obligationInputs: MtdDeadlineInput[] = obligations.map((o) => ({
    obligationId: o.id,
    taxYear: o.taxYear,
    period: o.period,
    dueDate: isoDate(o.dueDate) ?? today,
    status: "open",
  }));

  return {
    documents: documentInputs,
    arrears,
    upcomingRent,
    bankAccounts: bankInputs,
    obligations: obligationInputs,
  };
}
