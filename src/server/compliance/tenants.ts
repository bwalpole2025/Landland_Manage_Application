// Tenant records + Right to Rent checks (England). Derives the property-level
// Right to Rent facts the engine reads.

import type { PrismaClient, RightToRentStatus } from "@prisma/client";
import type { RightToRentFacts } from "@obligations-engine";

function isoDate(d: Date | null): string | null {
  return d ? d.toISOString().slice(0, 10) : null;
}
function toDate(iso: string | null | undefined): Date | null {
  return iso ? new Date(iso) : null;
}

export interface TenantView {
  id: string;
  name: string;
  email: string | null;
  rightToRentStatus: RightToRentStatus;
  rightToRentCheckedOn: string | null;
  rightToRentRecheckDue: string | null;
}

export async function listTenants(prisma: PrismaClient, accountId: string, propertyId: string): Promise<TenantView[]> {
  const rows = await prisma.tenantRecord.findMany({ where: { accountId, propertyId }, orderBy: { createdAt: "asc" } });
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    email: r.email,
    rightToRentStatus: r.rightToRentStatus,
    rightToRentCheckedOn: isoDate(r.rightToRentCheckedOn),
    rightToRentRecheckDue: isoDate(r.rightToRentRecheckDue),
  }));
}

export interface SaveTenantInput {
  name: string;
  email: string | null;
  rightToRentStatus: RightToRentStatus;
  rightToRentCheckedOn: string | null;
  rightToRentRecheckDue: string | null;
}

export async function addTenant(prisma: PrismaClient, accountId: string, propertyId: string, input: SaveTenantInput): Promise<string> {
  const row = await prisma.tenantRecord.create({
    data: {
      accountId,
      propertyId,
      name: input.name,
      email: input.email,
      rightToRentStatus: input.rightToRentStatus,
      rightToRentCheckedOn: toDate(input.rightToRentCheckedOn),
      rightToRentRecheckDue: toDate(input.rightToRentRecheckDue),
    },
  });
  return row.id;
}

export async function updateTenant(prisma: PrismaClient, accountId: string, tenantId: string, input: SaveTenantInput): Promise<void> {
  await prisma.tenantRecord.updateMany({
    where: { id: tenantId, accountId },
    data: {
      name: input.name,
      email: input.email,
      rightToRentStatus: input.rightToRentStatus,
      rightToRentCheckedOn: toDate(input.rightToRentCheckedOn),
      rightToRentRecheckDue: toDate(input.rightToRentRecheckDue),
    },
  });
}

export async function removeTenant(prisma: PrismaClient, accountId: string, tenantId: string): Promise<void> {
  await prisma.tenantRecord.deleteMany({ where: { id: tenantId, accountId } });
}

/** Property-level Right to Rent facts for the engine. */
export async function loadRightToRentFacts(prisma: PrismaClient, accountId: string, propertyId: string): Promise<RightToRentFacts> {
  const tenants = await prisma.tenantRecord.findMany({ where: { accountId, propertyId } });
  if (tenants.length === 0) return { hasTenants: false };

  const checksComplete = tenants.every((t) => t.rightToRentStatus !== "NOT_CHECKED");
  const recheckDates = tenants
    .filter((t) => t.rightToRentStatus === "TIME_LIMITED" && t.rightToRentRecheckDue)
    .map((t) => isoDate(t.rightToRentRecheckDue)!)
    .sort();
  return { hasTenants: true, checksComplete, recheckDue: recheckDates[0] ?? null };
}
