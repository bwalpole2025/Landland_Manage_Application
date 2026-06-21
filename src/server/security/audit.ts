// Append-only audit trail for significant actions: financial changes, external
// submissions (HMRC), data exports and deletions. Writing an audit entry must
// never break the underlying action, so failures are swallowed and logged.

import type { AuditAction, PrismaClient } from "@prisma/client";
import { prisma as defaultPrisma } from "@/server/db";

export interface AuditInput {
  accountId: string;
  actorUserId?: string | null;
  action: AuditAction;
  /** Entity type, e.g. "transaction", "mtd_submission", "account". */
  entity: string;
  entityId?: string | null;
  summary: string;
  metadata?: unknown;
  ipAddress?: string | null;
}

export async function recordAudit(input: AuditInput, prisma: PrismaClient = defaultPrisma): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        accountId: input.accountId,
        actorUserId: input.actorUserId ?? null,
        action: input.action,
        entity: input.entity,
        entityId: input.entityId ?? null,
        summary: input.summary,
        metadata: input.metadata != null ? JSON.stringify(input.metadata) : null,
        ipAddress: input.ipAddress ?? null,
      },
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[audit] failed to record entry", err);
  }
}

export interface AuditEntry {
  id: string;
  action: AuditAction;
  entity: string;
  entityId: string | null;
  summary: string;
  actorUserId: string | null;
  createdAt: string;
}

export async function listAudit(
  prisma: PrismaClient,
  accountId: string,
  limit = 100,
): Promise<AuditEntry[]> {
  const rows = await prisma.auditLog.findMany({
    where: { accountId },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
  return rows.map((r) => ({
    id: r.id,
    action: r.action,
    entity: r.entity,
    entityId: r.entityId,
    summary: r.summary,
    actorUserId: r.actorUserId,
    createdAt: r.createdAt.toISOString(),
  }));
}
