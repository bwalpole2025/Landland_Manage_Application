// Tenancy schedule + screen rollups. The expected-rent schedule generated here
// is the single source the arrears, upcoming-payments and rent-collection
// widgets derive from (they read the same rentDueDay/rentPence/startDate).

import { getProperty, getTenancies, getTransactions } from "@/services/repository";
import type { Pence, Tenancy } from "./types";
import { computeArrears } from "./arrears";
import { addressOneLine } from "./labels";
import { todayISO } from "./dates";
import { now as clockNow } from "./clock";

function pad(n: number): string {
  return String(n).padStart(2, "0");
}
function lastDayOfMonth(year: number, month1to12: number): number {
  return new Date(Date.UTC(year, month1to12, 0)).getUTCDate();
}

export interface ScheduleEntry {
  dueDate: string; // ISO date
  amountPence: Pence;
}

export interface ScheduleInput {
  rentDueDay: number;
  rentPence: Pence;
  rentFrequency: "monthly" | "weekly";
  startDate: string;
  endDate?: string;
}

/**
 * The expected-rent schedule: the next `count` due dates on/after `from`,
 * bounded by the tenancy's start and (optional) end date.
 */
export function generateRentSchedule(t: ScheduleInput, from: string, count = 6): ScheduleEntry[] {
  const out: ScheduleEntry[] = [];
  const floor = t.startDate > from ? t.startDate : from;

  if (t.rentFrequency === "weekly") {
    let d = new Date(`${t.startDate}T00:00:00Z`);
    while (out.length < count) {
      const iso = d.toISOString().slice(0, 10);
      if (iso >= floor && (!t.endDate || iso <= t.endDate)) out.push({ dueDate: iso, amountPence: t.rentPence });
      if (t.endDate && iso > t.endDate) break;
      d = new Date(d.getTime() + 7 * 86_400_000);
      if (d.getUTCFullYear() > new Date(`${floor}T00:00:00Z`).getUTCFullYear() + 2) break;
    }
    return out;
  }

  // Monthly: rentDueDay each month from the start month onward.
  let year = Number(t.startDate.slice(0, 4));
  let month = Number(t.startDate.slice(5, 7)); // 1–12
  for (let i = 0; i < 60 && out.length < count; i++) {
    const day = Math.min(t.rentDueDay, lastDayOfMonth(year, month));
    const iso = `${year}-${pad(month)}-${pad(day)}`;
    if (iso >= floor && iso >= t.startDate && (!t.endDate || iso <= t.endDate)) {
      out.push({ dueDate: iso, amountPence: t.rentPence });
    }
    if (t.endDate && iso > t.endDate) break;
    month += 1;
    if (month > 12) { month = 1; year += 1; }
  }
  return out;
}

/** The next rent due date on/after today for a tenancy. */
export function nextRentDueDate(t: ScheduleInput, now: Date = clockNow()): string | null {
  return generateRentSchedule(t, todayISO(now), 1)[0]?.dueDate ?? null;
}

export interface TenancyRow {
  id: string;
  propertyId: string;
  propertyName: string;
  propertyAddress: string;
  tenantName: string;
  status: Tenancy["status"];
  nextPaymentDate: string | null;
  depositPence: Pence;
  startDate: string;
  endDate: string | null; // null = ongoing
  rentPence: Pence;
  rentFrequency: "monthly" | "weekly";
  arrearsStatus: "up_to_date" | "in_arrears" | "in_credit";
  balancePence: Pence;
  tracked: boolean;
}

export function getTenancyRows(now: Date = clockNow()): TenancyRow[] {
  const txns = getTransactions();
  return getTenancies().map((t) => {
    const property = getProperty(t.propertyId);
    const a = computeArrears(t, txns, now);
    const tracked = txns.some((x) => x.tenancyId === t.id && x.direction === "income" && x.category === "rent" && !x.deactivated);
    return {
      id: t.id,
      propertyId: t.propertyId,
      propertyName: property?.nickname ?? "—",
      propertyAddress: property ? addressOneLine(property.address) : "",
      tenantName: t.tenants.map((x) => x.name).join(", "),
      status: t.status,
      nextPaymentDate: t.status === "active" ? nextRentDueDate(t, now) : null,
      depositPence: t.depositPence ?? 0,
      startDate: t.startDate,
      endDate: t.endDate ?? null,
      rentPence: t.rentPence,
      rentFrequency: t.rentFrequency,
      arrearsStatus: a.status,
      balancePence: a.balancePence,
      tracked,
    };
  });
}
