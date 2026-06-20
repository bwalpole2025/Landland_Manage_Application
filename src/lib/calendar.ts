// Calendar event aggregation across the app's time-based data:
//   - Upcoming rental Payments (from tenancy rent schedules, per tenant)
//   - document expiry events
//   - reminders
//   - account events (e.g. free-trial end)
// All date math uses the account time zone.

import { getActiveTenancyForProperty, getComplianceDocuments, getProperties, getReminders } from "@/services/repository";
import { generateRentSchedule } from "./tenancies";
import { categoryIdForDoc, categoryLabel } from "./documents";
import { now as clockNow } from "./clock";

export type CalendarEventType = "payment" | "expiry" | "reminder" | "account";

export interface CalendarEvent {
  id: string;
  type: CalendarEventType;
  date: string; // ISO date (account time zone)
  title: string;
  subtitle?: string;
  amountPence?: number;
  /** Link to the source record (tenancy, document, reminder, account). */
  href: string;
}

export const DEFAULT_TIME_ZONE = "Europe/London";

/** Today's date in the account time zone, as YYYY-MM-DD. */
export function todayInZone(timeZone: string = DEFAULT_TIME_ZONE, now: Date = clockNow()): string {
  return now.toLocaleDateString("en-CA", { timeZone }); // en-CA → YYYY-MM-DD
}

export interface CalendarOptions {
  /** Free-trial end date (account event), if the account is trialing. */
  trialEndsAt?: string | null;
}

/** All calendar events with a date in [start, end] (inclusive ISO dates). */
export function getCalendarEvents(start: string, end: string, opts: CalendarOptions = {}): CalendarEvent[] {
  const events: CalendarEvent[] = [];
  const inRange = (d: string) => d >= start && d <= end;

  // Upcoming rental payments — every rent due date in range, per tenant.
  for (const property of getProperties()) {
    const tenancy = getActiveTenancyForProperty(property.id);
    if (!tenancy) continue;
    const schedule = generateRentSchedule(tenancy, start, 36); // covers ~3 years of monthly rent
    for (const entry of schedule) {
      if (!inRange(entry.dueDate)) continue;
      events.push({
        id: `pay_${tenancy.id}_${entry.dueDate}`,
        type: "payment",
        date: entry.dueDate,
        title: `Rent — ${tenancy.tenants[0]?.name ?? "Tenant"}`,
        subtitle: property.nickname,
        amountPence: entry.amountPence,
        href: `/properties/${property.id}`,
      });
    }
  }

  // Document expiry events.
  for (const doc of getComplianceDocuments()) {
    if (!doc.expiryDate || !inRange(doc.expiryDate)) continue;
    events.push({
      id: `exp_${doc.id}`,
      type: "expiry",
      date: doc.expiryDate,
      title: `${categoryLabel(categoryIdForDoc(doc))} expires`,
      subtitle: getProperties().find((p) => p.id === doc.propertyId)?.nickname,
      href: "/files",
    });
  }

  // Reminders (open).
  for (const r of getReminders()) {
    if (r.status !== "open" || !inRange(r.dueDate)) continue;
    events.push({
      id: `rem_${r.id}`,
      type: "reminder",
      date: r.dueDate,
      title: r.name,
      subtitle: r.description,
      href: "/files/reminders",
    });
  }

  // Account events.
  if (opts.trialEndsAt) {
    const date = opts.trialEndsAt.slice(0, 10);
    if (inRange(date)) {
      events.push({ id: "acct_trial_end", type: "account", date, title: "Free trial ends", subtitle: "Add a payment method to continue", href: "/settings" });
    }
  }

  return events.sort((a, b) => (a.date < b.date ? -1 : 1));
}
