// Triggers: pure functions that turn domain data into NotificationEvents for a
// given "today" (an ISO date already resolved in the account's time zone). They
// take plain shapes — not Prisma rows — so the same logic backs both the unit
// tests (mock repository) and the worker (Prisma).
//
// Each event carries a stable `dedupeKey` encoding the threshold/occurrence, so
// the planner + ledger can guarantee exactly-once delivery per channel.

import { formatGBP } from "@/lib/money";
import type { NotificationCategory, NotificationEvent } from "./types";

// Reminder thresholds, in days before the relevant date.
export const DOC_EXPIRY_DAYS = [30, 14, 7, 1];
export const MTD_DEADLINE_DAYS = [30, 14, 7, 1];
export const CONSENT_EXPIRY_DAYS = [14, 7, 1];
export const RENT_LEAD_DAYS = [3, 1];

/** Whole days from `todayIso` to `targetIso` (both "YYYY-MM-DD"); negative = past. */
export function isoDaysUntil(todayIso: string, targetIso: string): number {
  const today = Date.parse(`${todayIso.slice(0, 10)}T00:00:00Z`);
  const target = Date.parse(`${targetIso.slice(0, 10)}T00:00:00Z`);
  return Math.round((target - today) / 86_400_000);
}

function plural(n: number): string {
  return n === 1 ? "" : "s";
}

// --- Inputs -----------------------------------------------------------------

export interface DocumentExpiryInput {
  id: string;
  title: string;
  propertyName?: string;
  expiryDate?: string | null;
}

export interface ArrearsInput {
  tenancyId: string;
  propertyName: string;
  tenantName?: string;
  balanceMinor: number;
  monthsBehind: number;
}

export interface RentReminderInput {
  tenancyId: string;
  propertyName: string;
  tenantName?: string;
  dueDate: string;
  amountMinor: number;
}

export interface BankFeedInput {
  id: string;
  bankName: string;
  accountName?: string;
  status: "connected" | "needs_reauth" | "disconnected";
  consentExpiresAt?: string | null;
}

export interface MtdDeadlineInput {
  obligationId: string;
  taxYear: string;
  period: string;
  dueDate: string;
  status: "open" | "fulfilled" | "overdue";
}

export interface TriggerInput {
  documents?: DocumentExpiryInput[];
  arrears?: ArrearsInput[];
  upcomingRent?: RentReminderInput[];
  bankAccounts?: BankFeedInput[];
  obligations?: MtdDeadlineInput[];
}

// --- Triggers ---------------------------------------------------------------

/** Document/certificate expiry reminders at 30/14/7/1 days before expiry. */
export function documentExpiryEvents(docs: DocumentExpiryInput[], today: string): NotificationEvent[] {
  const out: NotificationEvent[] = [];
  for (const doc of docs) {
    if (!doc.expiryDate) continue;
    const days = isoDaysUntil(today, doc.expiryDate);
    if (!DOC_EXPIRY_DAYS.includes(days)) continue;
    const where = doc.propertyName ? ` (${doc.propertyName})` : "";
    out.push({
      dedupeKey: `doc:${doc.id}:expiry:${days}`,
      category: "document_expiry",
      title: `${doc.title} expires in ${days} day${plural(days)}`,
      body: `${doc.title}${where} expires on ${doc.expiryDate.slice(0, 10)}. Renew it to stay compliant.`,
      href: "/files",
      date: doc.expiryDate.slice(0, 10),
    });
  }
  return out;
}

/** Missing-rent / arrears alerts — once per calendar month while in arrears. */
export function arrearsEvents(rows: ArrearsInput[], today: string): NotificationEvent[] {
  const month = today.slice(0, 7);
  return rows
    .filter((r) => r.balanceMinor > 0)
    .map((r) => ({
      dedupeKey: `arrears:${r.tenancyId}:${month}`,
      category: "arrears" as NotificationCategory,
      title: `Rent arrears — ${r.propertyName}`,
      body: `${formatGBP(r.balanceMinor)} outstanding${
        r.tenantName ? ` from ${r.tenantName}` : ""
      } (${r.monthsBehind} month${plural(r.monthsBehind)} behind).`,
      href: "/transactions",
      date: today,
    }));
}

/** Upcoming rent payment reminders, 3 and 1 day(s) before each due date. */
export function rentReminderEvents(rows: RentReminderInput[], today: string): NotificationEvent[] {
  const out: NotificationEvent[] = [];
  for (const r of rows) {
    const days = isoDaysUntil(today, r.dueDate);
    if (!RENT_LEAD_DAYS.includes(days)) continue;
    out.push({
      dedupeKey: `rent:${r.tenancyId}:${r.dueDate.slice(0, 10)}:${days}`,
      category: "rent_reminder",
      title: `Rent due in ${days} day${plural(days)} — ${r.propertyName}`,
      body: `${formatGBP(r.amountMinor)}${r.tenantName ? ` from ${r.tenantName}` : ""} is due on ${r.dueDate.slice(0, 10)}.`,
      href: "/transactions",
      date: r.dueDate.slice(0, 10),
    });
  }
  return out;
}

/** Bank-feed health: re-auth needed, or Open Banking consent nearing expiry. */
export function bankFeedEvents(banks: BankFeedInput[], today: string): NotificationEvent[] {
  const month = today.slice(0, 7);
  const out: NotificationEvent[] = [];
  for (const bank of banks) {
    const name = bank.accountName ? `${bank.bankName} — ${bank.accountName}` : bank.bankName;
    if (bank.status === "needs_reauth" || bank.status === "disconnected") {
      out.push({
        dedupeKey: `bank:${bank.id}:reauth:${month}`,
        category: "bank_feed",
        title: `Reconnect ${bank.bankName}`,
        body: `${name} needs re-authorisation to keep importing transactions.`,
        href: "/transactions",
        date: today,
      });
      continue;
    }
    if (bank.consentExpiresAt) {
      const days = isoDaysUntil(today, bank.consentExpiresAt);
      if (CONSENT_EXPIRY_DAYS.includes(days)) {
        out.push({
          dedupeKey: `bank:${bank.id}:consent:${days}`,
          category: "bank_feed",
          title: `${bank.bankName} access expires in ${days} day${plural(days)}`,
          body: `Re-authorise ${name} before ${bank.consentExpiresAt.slice(0, 10)} to avoid a gap in your bank feed.`,
          href: "/transactions",
          date: bank.consentExpiresAt.slice(0, 10),
        });
      }
    }
  }
  return out;
}

/** MTD quarterly-deadline reminders at 30/14/7/1 days before the due date. */
export function mtdDeadlineEvents(obligations: MtdDeadlineInput[], today: string): NotificationEvent[] {
  const out: NotificationEvent[] = [];
  for (const ob of obligations) {
    if (ob.status !== "open") continue;
    const days = isoDaysUntil(today, ob.dueDate);
    if (!MTD_DEADLINE_DAYS.includes(days)) continue;
    out.push({
      dedupeKey: `mtd:${ob.obligationId}:due:${days}`,
      category: "mtd_deadline",
      title: `MTD deadline in ${days} day${plural(days)} — ${ob.period} ${ob.taxYear}`,
      body: `Your ${ob.period} ${ob.taxYear} quarterly update is due on ${ob.dueDate.slice(0, 10)}.`,
      href: "/mtd",
      date: ob.dueDate.slice(0, 10),
    });
  }
  return out;
}

/**
 * Run every trigger and concatenate the events. `only` restricts to a subset of
 * categories (used by the category-scoped queues), otherwise all run.
 */
export function collectNotificationEvents(
  input: TriggerInput,
  today: string,
  only?: NotificationCategory[],
): NotificationEvent[] {
  const want = (c: NotificationCategory) => !only || only.includes(c);
  const events: NotificationEvent[] = [];
  if (want("document_expiry")) events.push(...documentExpiryEvents(input.documents ?? [], today));
  if (want("arrears")) events.push(...arrearsEvents(input.arrears ?? [], today));
  if (want("rent_reminder")) events.push(...rentReminderEvents(input.upcomingRent ?? [], today));
  if (want("bank_feed")) events.push(...bankFeedEvents(input.bankAccounts ?? [], today));
  if (want("mtd_deadline")) events.push(...mtdDeadlineEvents(input.obligations ?? [], today));
  return events;
}
