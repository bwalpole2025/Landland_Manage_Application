"use server";

import { revalidatePath } from "next/cache";
import { getSession } from "@/server/auth/session";
import { prisma } from "@/server/db";
import { addTenant, removeTenant } from "@/server/compliance/tenants";
import { appendActivity } from "@/server/compliance/activity";
import type { RightToRentStatus } from "@prisma/client";

export type ActionResult = { ok: true } | { ok: false; error: string };
const STATUSES: RightToRentStatus[] = ["UNLIMITED", "TIME_LIMITED", "NOT_CHECKED"];

function revalidate(propertyId: string) {
  revalidatePath(`/properties/${propertyId}/tenants`);
  revalidatePath(`/properties/${propertyId}/essentials`);
  revalidatePath(`/properties/${propertyId}/activity`);
}

export async function addTenantAction(input: {
  propertyId: string;
  name: string;
  email: string | null;
  rightToRentStatus: string;
  rightToRentCheckedOn: string | null;
  rightToRentRecheckDue: string | null;
}): Promise<ActionResult> {
  const session = await getSession();
  if (!session) return { ok: false, error: "Not signed in." };
  if (!input.name.trim()) return { ok: false, error: "Enter the tenant's name." };
  const status = (STATUSES.includes(input.rightToRentStatus as RightToRentStatus) ? input.rightToRentStatus : "NOT_CHECKED") as RightToRentStatus;

  const id = await addTenant(prisma, session.account.id, input.propertyId, {
    name: input.name.trim(),
    email: input.email || null,
    rightToRentStatus: status,
    rightToRentCheckedOn: input.rightToRentCheckedOn || null,
    rightToRentRecheckDue: input.rightToRentRecheckDue || null,
  });
  await appendActivity(prisma, {
    accountId: session.account.id,
    propertyId: input.propertyId,
    actorUserId: session.user.id,
    actorName: session.user.name,
    action: "CREATE",
    entity: "tenant",
    entityId: id,
    summary: `Added tenant ${input.name.trim()} (Right to Rent: ${status.toLowerCase()})`,
  });
  revalidate(input.propertyId);
  return { ok: true };
}

export async function removeTenantAction(input: { propertyId: string; tenantId: string }): Promise<ActionResult> {
  const session = await getSession();
  if (!session) return { ok: false, error: "Not signed in." };
  await removeTenant(prisma, session.account.id, input.tenantId);
  await appendActivity(prisma, {
    accountId: session.account.id,
    propertyId: input.propertyId,
    actorUserId: session.user.id,
    actorName: session.user.name,
    action: "DELETE",
    entity: "tenant",
    entityId: input.tenantId,
    summary: "Removed a tenant record",
  });
  revalidate(input.propertyId);
  return { ok: true };
}
