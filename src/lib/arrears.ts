// Rent-arrears calculation.
//
// For each active tenancy we count the rent due-dates that have fallen inside a
// rolling window (default: the 3 most recent calendar months up to today) and
// compare the expected total against rent actually received. A shortfall of at
// least half a month's rent is treated as "in arrears" and drives the
// missing-rent alerts on the dashboard.

import type { Pence, Tenancy, Transaction } from "./types";
import { now as clockNow } from "./clock";
import { sumPence } from "./money";
import { todayISO } from "./dates";

const WINDOW_MONTHS = 3;

/**
 * The date a rent payment counts against — the rent DUE date when recorded,
 * otherwise the bank date. Rent is matched to the schedule by this date, since
 * the bank date can differ (e.g. due on the 1st, banked on the 8th).
 */
export function rentDueDateOf(t: Transaction): string {
  return t.rentDueDate ?? t.date;
}

export type ArrearsStatus = "up_to_date" | "in_arrears" | "in_credit";

export interface ArrearsResult {
  tenancyId: string;
  propertyId: string;
  expectedPence: Pence;
  receivedPence: Pence;
  /** expected − received. Positive means the tenant owes money. */
  balancePence: Pence;
  status: ArrearsStatus;
  /** Number of whole months the balance represents (rounded). */
  monthsBehind: number;
  lastPaymentDate?: string;
  dueDatesInWindow: string[];
}

function daysInMonth(year: number, month1to12: number): number {
  return new Date(Date.UTC(year, month1to12, 0)).getUTCDate();
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function dueDatesInWindow(dueDay: number, now: Date): string[] {
  const today = todayISO(now);
  const endYear = now.getUTCFullYear();
  const endMonth = now.getUTCMonth() + 1; // 1–12
  // Start month = (WINDOW_MONTHS - 1) months before the current month.
  let m = endMonth - (WINDOW_MONTHS - 1);
  let y = endYear;
  while (m <= 0) {
    m += 12;
    y -= 1;
  }
  const dates: string[] = [];
  while (y < endYear || (y === endYear && m <= endMonth)) {
    const day = Math.min(dueDay, daysInMonth(y, m));
    const iso = `${y}-${pad(m)}-${pad(day)}`;
    if (iso <= today) dates.push(iso);
    m += 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
  }
  return dates;
}

export function computeArrears(
  tenancy: Tenancy,
  transactions: Transaction[],
  now: Date = clockNow(),
): ArrearsResult {
  const dueDates = dueDatesInWindow(tenancy.rentDueDay, now);
  const windowStart = dueDates.length
    ? `${dueDates[0].slice(0, 7)}-01`
    : todayISO(now);

  const rentReceived = transactions.filter(
    (t) =>
      t.tenancyId === tenancy.id &&
      t.direction === "income" &&
      t.category === "rent" &&
      !t.deactivated &&
      rentDueDateOf(t) >= windowStart,
  );

  const expectedPence = dueDates.length * tenancy.rentPence;
  const receivedPence = sumPence(rentReceived.map((t) => t.amountPence));
  const balancePence = expectedPence - receivedPence;

  const halfMonth = tenancy.rentPence / 2;
  let status: ArrearsStatus = "up_to_date";
  if (balancePence >= halfMonth) status = "in_arrears";
  else if (balancePence <= -halfMonth) status = "in_credit";

  const lastPaymentDate = rentReceived
    .map((t) => rentDueDateOf(t))
    .sort()
    .at(-1);

  return {
    tenancyId: tenancy.id,
    propertyId: tenancy.propertyId,
    expectedPence,
    receivedPence,
    balancePence,
    status,
    monthsBehind: Math.round(balancePence / tenancy.rentPence),
    lastPaymentDate,
    dueDatesInWindow: dueDates,
  };
}
