// Notes aggregator. Notes can be created against a property, a tenancy or a
// transaction; this collects them all into one list for the Notes screen.

import { getAllNotes, getProperty, getTenancies, getTransactions } from "@/services/repository";

export interface AggregatedNote {
  id: string;
  linkedToType: "property" | "tenant" | "transaction";
  linkedToLabel: string;
  propertyId?: string;
  tenancyId?: string;
  description: string;
  date: string; // ISO date/datetime
}

function tenantNameForTenancy(tenancyId: string): string {
  const t = getTenancies().find((x) => x.id === tenancyId);
  return t?.tenants[0]?.name ?? "Tenant";
}

/** All notes — from properties, tenancies and transactions — newest first. */
export function getAggregatedNotes(): AggregatedNote[] {
  const out: AggregatedNote[] = [];

  for (const n of getAllNotes()) {
    if (n.tenancyId) {
      out.push({ id: n.id, linkedToType: "tenant", linkedToLabel: tenantNameForTenancy(n.tenancyId), propertyId: n.propertyId, tenancyId: n.tenancyId, description: n.body, date: n.createdAt });
    } else {
      out.push({ id: n.id, linkedToType: "property", linkedToLabel: getProperty(n.propertyId)?.nickname ?? "Property", propertyId: n.propertyId, description: n.body, date: n.createdAt });
    }
  }

  for (const t of getTransactions()) {
    if (!t.notes) continue;
    out.push({ id: `note_tx_${t.id}`, linkedToType: "transaction", linkedToLabel: t.description, propertyId: t.propertyId, tenancyId: t.tenancyId, description: t.notes, date: t.date });
  }

  return out.sort((a, b) => (a.date < b.date ? 1 : -1));
}
