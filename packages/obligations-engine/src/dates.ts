// Pure UTC date arithmetic on ISO "YYYY-MM-DD" strings. No timezone surprises,
// leap-year safe, and total (every helper returns for every input).

const MS_PER_DAY = 86_400_000;

/** Parse an ISO date (date-only or datetime) to a UTC midnight Date. */
export function isoToUTC(iso: string): Date {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1));
}

/** Format a Date as an ISO date-only string. */
export function toISODate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Days in a given (UTC) year/month. month is 1-based. */
function daysInMonth(year: number, month1: number): number {
  return new Date(Date.UTC(year, month1, 0)).getUTCDate();
}

/**
 * Add (or subtract) whole calendar months, clamping the day to the end of the
 * target month. Leap-year safe:
 *   addMonths("2024-02-29", 12)  -> "2025-02-28"  (no 29th in 2025)
 *   addMonths("2024-04-30", -2)  -> "2024-02-29"  (clamped, leap year)
 */
export function addMonths(iso: string, months: number): string {
  const date = isoToUTC(iso);
  const y = date.getUTCFullYear();
  const m = date.getUTCMonth(); // 0-based
  const d = date.getUTCDate();

  const totalMonths = m + months;
  const targetYear = y + Math.floor(totalMonths / 12);
  const targetMonth0 = ((totalMonths % 12) + 12) % 12; // 0-based, normalized
  const clampedDay = Math.min(d, daysInMonth(targetYear, targetMonth0 + 1));

  return toISODate(new Date(Date.UTC(targetYear, targetMonth0, clampedDay)));
}

/** Whole days from `fromIso` to `toIso` (negative when `toIso` is earlier). */
export function daysBetween(fromIso: string, toIso: string): number {
  return Math.round((isoToUTC(toIso).getTime() - isoToUTC(fromIso).getTime()) / MS_PER_DAY);
}

/** Add (or subtract) whole days to an ISO date. */
export function addDays(iso: string, days: number): string {
  return toISODate(new Date(isoToUTC(iso).getTime() + days * MS_PER_DAY));
}

/** Lexicographic comparison works for ISO date-only strings; normalize first. */
export function compareISO(a: string, b: string): number {
  const aa = a.slice(0, 10);
  const bb = b.slice(0, 10);
  return aa < bb ? -1 : aa > bb ? 1 : 0;
}
