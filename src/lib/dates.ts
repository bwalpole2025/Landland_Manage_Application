// UK tax-year-aware date helpers. The UK tax year runs 6 April – 5 April.
// Reminder thresholds for compliance documents: 30 / 14 / 7 / 1 days before expiry.
//
// `now` defaults to the scaffold clock (see lib/clock.ts) so seeded data renders
// deterministically; callers may pass a real Date to override.

import { now as clockNow } from "./clock";

export const REMINDER_THRESHOLDS = [30, 14, 7, 1] as const;

const MS_PER_DAY = 1000 * 60 * 60 * 24;

/** Parse a "YYYY-MM-DD" date string to a UTC Date at midnight. */
export function parseISODate(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

export function todayISO(now: Date = clockNow()): string {
  return now.toISOString().slice(0, 10);
}

/** Whole days from `now` until `iso` (negative if in the past). */
export function daysUntil(iso: string, now: Date = clockNow()): number {
  const target = parseISODate(iso).getTime();
  const start = parseISODate(todayISO(now)).getTime();
  return Math.round((target - start) / MS_PER_DAY);
}

/** UK tax year for a given date, e.g. "2026/27". Boundary is 6 April. */
export function taxYearFor(date: Date = clockNow()): string {
  const year = date.getUTCFullYear();
  const isBefore6April =
    date.getUTCMonth() < 3 || (date.getUTCMonth() === 3 && date.getUTCDate() < 6);
  const startYear = isBefore6April ? year - 1 : year;
  return `${startYear}/${String((startYear + 1) % 100).padStart(2, "0")}`;
}

/** Inclusive start/end ISO dates for a "2026/27"-style tax year. */
export function taxYearBounds(taxYear: string): { start: string; end: string } {
  const startYear = Number(taxYear.split("/")[0]);
  return { start: `${startYear}-04-06`, end: `${startYear + 1}-04-05` };
}

export type ReminderUrgency = "expired" | "critical" | "soon" | "upcoming" | "ok";

/** Classify a document by how close its expiry is, against the reminder thresholds. */
export function expiryUrgency(expiryDate: string | undefined, now: Date = clockNow()): {
  urgency: ReminderUrgency;
  days: number | null;
} {
  if (!expiryDate) return { urgency: "ok", days: null };
  const days = daysUntil(expiryDate, now);
  if (days < 0) return { urgency: "expired", days };
  if (days <= 7) return { urgency: "critical", days };
  if (days <= 14) return { urgency: "soon", days };
  if (days <= 30) return { urgency: "upcoming", days };
  return { urgency: "ok", days };
}

/** Friendly relative phrase, e.g. "in 5 days", "today", "12 days ago". */
export function relativeDays(days: number): string {
  if (days === 0) return "today";
  if (days === 1) return "tomorrow";
  if (days === -1) return "yesterday";
  return days > 0 ? `in ${days} days` : `${Math.abs(days)} days ago`;
}

/** Format "YYYY-MM-DD" as e.g. "20 Jun 2026". */
export function formatDate(iso: string): string {
  return parseISODate(iso).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

/** Compact, friendly due-date, e.g. "5th Jul". */
export function formatDueDateShort(iso: string): string {
  const d = parseISODate(iso);
  const day = d.getUTCDate();
  const v = day % 100;
  const suffix = ["th", "st", "nd", "rd"][(v - 20) % 10] ?? ["th", "st", "nd", "rd"][v] ?? "th";
  const month = d.toLocaleDateString("en-GB", { month: "short", timeZone: "UTC" });
  return `${day}${suffix} ${month}`;
}

/** Format an ISO datetime as e.g. "20 Jun 2026, 14:32". */
export function formatDateTime(isoDateTime: string): string {
  return new Date(isoDateTime).toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
