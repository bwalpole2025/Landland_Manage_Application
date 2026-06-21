"use server";

import { revalidatePath } from "next/cache";
import { getSession } from "@/server/auth/session";
import { prisma } from "@/server/db";
import { appendActivity } from "@/server/compliance/activity";

export type ActionResult = { ok: true } | { ok: false; error: string };

/**
 * The activity trail is append-only: a correction is a NEW row, never an edit of
 * an existing one.
 */
export async function recordCorrectionAction(input: {
  propertyId: string;
  summary: string;
  correctsId: string | null;
}): Promise<ActionResult> {
  const session = await getSession();
  if (!session) return { ok: false, error: "Not signed in." };
  if (!input.summary.trim()) return { ok: false, error: "Describe the correction." };

  await appendActivity(prisma, {
    accountId: session.account.id,
    propertyId: input.propertyId,
    actorUserId: session.user.id,
    actorName: session.user.name,
    action: "CORRECTION",
    entity: "activity",
    entityId: input.correctsId,
    summary: input.summary.trim(),
    isCorrection: true,
    correctsId: input.correctsId,
  });
  revalidatePath(`/properties/${input.propertyId}/activity`);
  return { ok: true };
}
