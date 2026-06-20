// Document categories, expiry windows, and reminder scheduling for the
// compliance / receipts area. Pure and testable.

import type { ComplianceDocType } from "./types";
import { daysUntil, todayISO } from "./dates";
import { now as clockNow } from "./clock";

export type DocGroup = "compliance" | "insurance" | "financial" | "tenancy" | "branding" | "import" | "receipt" | "other";

export interface DocCategory {
  id: string;
  label: string;
  group: DocGroup;
}

/** Built-in document categories. */
export const BUILT_IN_CATEGORIES: DocCategory[] = [
  { id: "electrical_safety", label: "Electrical Safety Certificate", group: "compliance" },
  { id: "epc", label: "EPC", group: "compliance" },
  { id: "fire_alarm", label: "Fire Alarm Certificate", group: "compliance" },
  { id: "fire_safety", label: "Fire Safety Certificate", group: "compliance" },
  { id: "gas_safety", label: "Gas Safety Certificate", group: "compliance" },
  { id: "hmo_license", label: "HMO License", group: "compliance" },
  { id: "legionella", label: "Legionella Risk Assessment", group: "compliance" },
  { id: "pat_test", label: "PAT Test", group: "compliance" },
  { id: "insurance_buildings", label: "Insurance — Buildings", group: "insurance" },
  { id: "insurance_contents", label: "Insurance — Contents", group: "insurance" },
  { id: "insurance_rent_guarantee", label: "Insurance — Rent Guarantee", group: "insurance" },
  { id: "insurance_landlord", label: "Insurance — Landlord", group: "insurance" },
  { id: "insurance_appliance", label: "Insurance — Appliance", group: "insurance" },
  { id: "insurance_deposit", label: "Insurance — Deposit", group: "insurance" },
  { id: "insurance_mortgage_protection", label: "Insurance — Mortgage Protection", group: "insurance" },
  { id: "insurance_general", label: "Insurance — General", group: "insurance" },
  { id: "inventory", label: "Inventory", group: "tenancy" },
  { id: "tenancy_agreement", label: "Tenancy Agreement", group: "tenancy" },
  { id: "tenant_reference", label: "Tenant Reference", group: "tenancy" },
  { id: "letting_agent_statement", label: "Letting Agent Statement", group: "financial" },
  { id: "mortgage", label: "Mortgage", group: "financial" },
  { id: "logo", label: "Logo", group: "branding" },
  { id: "import_client", label: "Client Import", group: "import" },
  { id: "import_property", label: "Property Import", group: "import" },
  { id: "import_tenant", label: "Tenant Import", group: "import" },
  { id: "import_transactions", label: "Transactions Import", group: "import" },
  { id: "receipt", label: "Receipt / Invoice", group: "receipt" },
  { id: "other", label: "Other", group: "other" },
];

const BY_ID = new Map(BUILT_IN_CATEGORIES.map((c) => [c.id, c]));

/** Map the legacy ComplianceDocType onto a category id. */
const TYPE_TO_CATEGORY: Record<ComplianceDocType, string> = {
  gas_safety: "gas_safety",
  eicr: "electrical_safety",
  epc: "epc",
  insurance: "insurance_landlord",
  tenancy_agreement: "tenancy_agreement",
  right_to_rent: "tenant_reference",
  deposit_protection: "insurance_deposit",
  other: "other",
};

export function categoryIdForDoc(d: { category?: string; type: ComplianceDocType }): string {
  return d.category ?? TYPE_TO_CATEGORY[d.type] ?? "other";
}

export function categoryLabel(id: string, custom: DocCategory[] = []): string {
  return BY_ID.get(id)?.label ?? custom.find((c) => c.id === id)?.label ?? id;
}

export function categoryGroup(id: string, custom: DocCategory[] = []): DocGroup {
  return BY_ID.get(id)?.group ?? custom.find((c) => c.id === id)?.group ?? "other";
}

// --- Reminders ---------------------------------------------------------------

export const REMINDER_DAYS = [30, 14, 7, 1] as const;

export interface ScheduledReminder {
  daysBefore: number;
  date: string; // ISO date the reminder fires
}

/**
 * Reminders to fire 30/14/7/1 days before expiry. Returns only future-dated
 * reminders, and none at all when notifications are disabled.
 */
export function reminderSchedule(
  expiryDate: string | undefined,
  notificationsEnabled: boolean,
  now: Date = clockNow(),
): ScheduledReminder[] {
  if (!expiryDate || !notificationsEnabled) return [];
  const today = todayISO(now);
  const expiryMs = new Date(`${expiryDate}T00:00:00Z`).getTime();
  return REMINDER_DAYS.map((d) => ({ daysBefore: d, date: new Date(expiryMs - d * 86_400_000).toISOString().slice(0, 10) }))
    .filter((r) => r.date >= today)
    .sort((a, b) => (a.date < b.date ? -1 : 1));
}

// --- Expiry windows ----------------------------------------------------------

export const EXPIRY_WINDOWS: { id: string; label: string; days: number | null }[] = [
  { id: "any", label: "Any expiry", days: null },
  { id: "2w", label: "Within 2 weeks", days: 14 },
  { id: "1m", label: "Within 1 month", days: 30 },
  { id: "3m", label: "Within 3 months", days: 90 },
  { id: "6m", label: "Within 6 months", days: 180 },
];

/** True when a document's expiry falls within `windowDays` (incl. overdue). */
export function withinExpiryWindow(expiryDate: string | undefined, windowDays: number | null, now: Date = clockNow()): boolean {
  if (windowDays == null) return true;
  if (!expiryDate) return false;
  return daysUntil(expiryDate, now) <= windowDays;
}
