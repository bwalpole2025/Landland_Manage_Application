"use server";

import { revalidatePath } from "next/cache";
import { getSession } from "@/server/auth/session";
import { prisma } from "@/server/db";
import { addMaintenance, markMaintenance, removeMaintenance } from "@/server/compliance/maintenance";
import { appendActivity } from "@/server/compliance/activity";

export type ActionResult = { ok: true } | { ok: false; error: string };

function revalidate(propertyId: string) {
  revalidatePath(`/properties/${propertyId}/maintenance`);
  revalidatePath(`/properties/${propertyId}/activity`);
}

export async function addMaintenanceAction(input: {
  propertyId: string;
  category: string;
  description: string;
  hazard: boolean;
  reportedAt: string | null;
}): Promise<ActionResult> {
  const session = await getSession();
  if (!session) return { ok: false, error: "Not signed in." };
  if (!input.description.trim()) return { ok: false, error: "Describe the repair." };
  const reportedAt = input.reportedAt || new Date().toISOString();

  const id = await addMaintenance(prisma, session.account.id, input.propertyId, {
    category: input.category || "Other",
    description: input.description.trim(),
    hazard: input.hazard,
    reportedAt,
  });
  await appendActivity(prisma, {
    accountId: session.account.id,
    propertyId: input.propertyId,
    actorUserId: session.user.id,
    actorName: session.user.name,
    action: "CREATE",
    entity: "maintenance",
    entityId: id,
    summary: `Logged repair: ${input.description.trim()}${input.hazard ? " (HAZARD)" : ""}`,
  });
  revalidate(input.propertyId);
  return { ok: true };
}

export async function markMaintenanceAction(input: {
  propertyId: string;
  logId: string;
  respond?: boolean;
  resolve?: boolean;
}): Promise<ActionResult> {
  const session = await getSession();
  if (!session) return { ok: false, error: "Not signed in." };
  await markMaintenance(prisma, session.account.id, input.logId, { respond: input.respond, resolve: input.resolve });
  await appendActivity(prisma, {
    accountId: session.account.id,
    propertyId: input.propertyId,
    actorUserId: session.user.id,
    actorName: session.user.name,
    action: "UPDATE",
    entity: "maintenance",
    entityId: input.logId,
    summary: input.resolve ? "Marked repair resolved" : "Recorded a response to a repair",
  });
  revalidate(input.propertyId);
  return { ok: true };
}

export async function removeMaintenanceAction(input: { propertyId: string; logId: string }): Promise<ActionResult> {
  const session = await getSession();
  if (!session) return { ok: false, error: "Not signed in." };
  await removeMaintenance(prisma, session.account.id, input.logId);
  await appendActivity(prisma, {
    accountId: session.account.id,
    propertyId: input.propertyId,
    actorUserId: session.user.id,
    actorName: session.user.name,
    action: "DELETE",
    entity: "maintenance",
    entityId: input.logId,
    summary: "Removed a repair log entry",
  });
  revalidate(input.propertyId);
  return { ok: true };
}
