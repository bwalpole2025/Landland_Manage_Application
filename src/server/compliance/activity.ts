// APPEND-ONLY activity trail: who changed what and when. Rows are never updated
// or deleted (a DB trigger enforces this); a correction is a NEW row referencing
// the original.

import type { PrismaClient } from "@prisma/client";

export interface AppendActivityInput {
  accountId: string;
  propertyId?: string | null;
  actorUserId?: string | null;
  actorName?: string | null;
  action: string;
  entity: string;
  entityId?: string | null;
  summary: string;
  isCorrection?: boolean;
  correctsId?: string | null;
}

/** Append one activity row. Failures never break the underlying action. */
export async function appendActivity(prisma: PrismaClient, input: AppendActivityInput): Promise<void> {
  try {
    await prisma.activityLog.create({
      data: {
        accountId: input.accountId,
        propertyId: input.propertyId ?? null,
        actorUserId: input.actorUserId ?? null,
        actorName: input.actorName ?? null,
        action: input.action,
        entity: input.entity,
        entityId: input.entityId ?? null,
        summary: input.summary,
        isCorrection: input.isCorrection ?? false,
        correctsId: input.correctsId ?? null,
      },
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[activity] append failed", err);
  }
}

export interface ActivityView {
  id: string;
  propertyId: string | null;
  actorName: string | null;
  action: string;
  entity: string;
  entityId: string | null;
  summary: string;
  isCorrection: boolean;
  correctsId: string | null;
  createdAt: string;
}

export async function listActivity(
  prisma: PrismaClient,
  accountId: string,
  propertyId: string,
  limit = 100,
): Promise<ActivityView[]> {
  const rows = await prisma.activityLog.findMany({
    where: { accountId, propertyId },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
  return rows.map((r) => ({
    id: r.id,
    propertyId: r.propertyId,
    actorName: r.actorName,
    action: r.action,
    entity: r.entity,
    entityId: r.entityId,
    summary: r.summary,
    isCorrection: r.isCorrection,
    correctsId: r.correctsId,
    createdAt: r.createdAt.toISOString(),
  }));
}
