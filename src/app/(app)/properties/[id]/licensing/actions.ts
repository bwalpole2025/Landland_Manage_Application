"use server";

import { revalidatePath } from "next/cache";
import { getSession } from "@/server/auth/session";
import { prisma } from "@/server/db";
import { addLicence, removeLicence } from "@/server/compliance/licensing";
import { appendActivity } from "@/server/compliance/activity";
import type { LicenceType } from "@prisma/client";

export type ActionResult = { ok: true } | { ok: false; error: string };
const TYPES: LicenceType[] = ["HMO", "ADDITIONAL", "SELECTIVE"];

function revalidate(propertyId: string) {
  revalidatePath(`/properties/${propertyId}/licensing`);
  revalidatePath(`/properties/${propertyId}/essentials`);
  revalidatePath(`/properties/${propertyId}/activity`);
}

export async function addLicenceAction(input: {
  propertyId: string;
  type: string;
  reference: string | null;
  grantedOn: string | null;
  expiresOn: string | null;
}): Promise<ActionResult> {
  const session = await getSession();
  if (!session) return { ok: false, error: "Not signed in." };
  if (!TYPES.includes(input.type as LicenceType)) return { ok: false, error: "Invalid licence type." };

  const id = await addLicence(prisma, session.account.id, input.propertyId, {
    type: input.type as LicenceType,
    reference: input.reference || null,
    grantedOn: input.grantedOn || null,
    expiresOn: input.expiresOn || null,
  });
  await appendActivity(prisma, {
    accountId: session.account.id,
    propertyId: input.propertyId,
    actorUserId: session.user.id,
    actorName: session.user.name,
    action: "CREATE",
    entity: "licence",
    entityId: id,
    summary: `Added ${input.type} licence${input.expiresOn ? ` (expires ${input.expiresOn})` : ""}`,
  });
  revalidate(input.propertyId);
  return { ok: true };
}

export async function removeLicenceAction(input: { propertyId: string; licenceId: string }): Promise<ActionResult> {
  const session = await getSession();
  if (!session) return { ok: false, error: "Not signed in." };
  await removeLicence(prisma, session.account.id, input.licenceId);
  await appendActivity(prisma, {
    accountId: session.account.id,
    propertyId: input.propertyId,
    actorUserId: session.user.id,
    actorName: session.user.name,
    action: "DELETE",
    entity: "licence",
    entityId: input.licenceId,
    summary: "Removed a licence record",
  });
  revalidate(input.propertyId);
  return { ok: true };
}
