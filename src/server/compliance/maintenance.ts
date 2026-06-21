// Repairs log: timestamps each request and response. Evidences hazard-response
// duties (Awaab's Law) and supports Section 8 grounds.

import type { PrismaClient } from "@prisma/client";

function iso(d: Date | null): string | null {
  return d ? d.toISOString() : null;
}

export interface MaintenanceView {
  id: string;
  category: string;
  description: string;
  hazard: boolean;
  reportedAt: string;
  respondedAt: string | null;
  resolvedAt: string | null;
  /** Hours from report to first response (null until responded). */
  responseHours: number | null;
}

export async function listMaintenance(prisma: PrismaClient, accountId: string, propertyId: string): Promise<MaintenanceView[]> {
  const rows = await prisma.maintenanceLog.findMany({ where: { accountId, propertyId }, orderBy: { reportedAt: "desc" } });
  return rows.map((r) => ({
    id: r.id,
    category: r.category,
    description: r.description,
    hazard: r.hazard,
    reportedAt: r.reportedAt.toISOString(),
    respondedAt: iso(r.respondedAt),
    resolvedAt: iso(r.resolvedAt),
    responseHours: r.respondedAt ? Math.round((r.respondedAt.getTime() - r.reportedAt.getTime()) / 3_600_000) : null,
  }));
}

export async function addMaintenance(
  prisma: PrismaClient,
  accountId: string,
  propertyId: string,
  input: { category: string; description: string; hazard: boolean; reportedAt: string },
): Promise<string> {
  const row = await prisma.maintenanceLog.create({
    data: { accountId, propertyId, category: input.category, description: input.description, hazard: input.hazard, reportedAt: new Date(input.reportedAt) },
  });
  return row.id;
}

/** Timestamp a response or resolution against a logged request. */
export async function markMaintenance(
  prisma: PrismaClient,
  accountId: string,
  logId: string,
  input: { respond?: boolean; resolve?: boolean },
): Promise<void> {
  const data: { respondedAt?: Date; resolvedAt?: Date } = {};
  const at = new Date();
  if (input.respond) data.respondedAt = at;
  if (input.resolve) {
    data.resolvedAt = at;
    // Resolving implies a response too.
    const row = await prisma.maintenanceLog.findFirst({ where: { id: logId, accountId } });
    if (row && !row.respondedAt) data.respondedAt = at;
  }
  await prisma.maintenanceLog.updateMany({ where: { id: logId, accountId }, data });
}

export async function removeMaintenance(prisma: PrismaClient, accountId: string, logId: string): Promise<void> {
  await prisma.maintenanceLog.deleteMany({ where: { id: logId, accountId } });
}
