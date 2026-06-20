// Aggregates the things that need a landlord's attention into one list:
// rent arrears, compliance documents nearing/past expiry, and bank-feed issues.
// Used by the topbar badge and the dashboard alerts panel.

import {
  getActiveTenancyForProperty,
  getBankAccounts,
  getComplianceDocuments,
  getProperties,
  getTransactions,
} from "@/services/repository";
import { computeArrears } from "./arrears";
import { expiryUrgency, type ReminderUrgency } from "./dates";
import { formatGBP } from "./money";

export type AlertSeverity = "danger" | "warning" | "info";

export interface Alert {
  id: string;
  severity: AlertSeverity;
  title: string;
  detail: string;
  href: string;
  /** Sort key — lower is more urgent. */
  rank: number;
}

const urgencyRank: Record<ReminderUrgency, number> = {
  expired: 0,
  critical: 1,
  soon: 2,
  upcoming: 3,
  ok: 9,
};

export function getAlerts(): Alert[] {
  const alerts: Alert[] = [];
  const properties = getProperties();
  const propertyName = (id: string) =>
    properties.find((p) => p.id === id)?.nickname ?? "Property";

  // --- Rent arrears ---
  const allTransactions = getTransactions();
  for (const property of properties) {
    const tenancy = getActiveTenancyForProperty(property.id);
    if (!tenancy) continue;
    const arrears = computeArrears(tenancy, allTransactions);
    if (arrears.status === "in_arrears") {
      alerts.push({
        id: `arrears-${tenancy.id}`,
        severity: "danger",
        title: `Rent arrears — ${property.nickname}`,
        detail: `${formatGBP(arrears.balancePence)} outstanding (${arrears.monthsBehind} month${
          arrears.monthsBehind === 1 ? "" : "s"
        } behind).`,
        href: "/transactions",
        rank: 0,
      });
    }
  }

  // --- Compliance document expiry (30 / 14 / 7 / 1 day reminders) ---
  for (const doc of getComplianceDocuments()) {
    if (!doc.expiryDate) continue;
    const { urgency, days } = expiryUrgency(doc.expiryDate);
    if (urgency === "ok") continue;
    const severity: AlertSeverity =
      urgency === "expired" || urgency === "critical" ? "danger" : "warning";
    const when =
      days! < 0 ? `expired ${Math.abs(days!)} day${days === -1 ? "" : "s"} ago` : `expires in ${days} day${days === 1 ? "" : "s"}`;
    alerts.push({
      id: `doc-${doc.id}`,
      severity,
      title: `${doc.title} — ${propertyName(doc.propertyId)}`,
      detail: `Certificate ${when}.`,
      href: "/files",
      rank: 1 + urgencyRank[urgency] / 10,
    });
  }

  // --- Bank feed health ---
  for (const bank of getBankAccounts()) {
    if (bank.status === "needs_reauth") {
      alerts.push({
        id: `bank-${bank.id}`,
        severity: "warning",
        title: `Reconnect ${bank.bankName}`,
        detail: `${bank.accountName} (${bank.maskedNumber}) needs re-authorisation to keep syncing.`,
        href: "/transactions",
        rank: 2,
      });
    }
  }

  return alerts.sort((a, b) => a.rank - b.rank);
}
