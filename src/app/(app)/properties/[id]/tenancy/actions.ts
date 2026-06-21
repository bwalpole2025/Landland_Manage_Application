"use server";

import { revalidatePath } from "next/cache";
import { getSession } from "@/server/auth/session";
import { prisma } from "@/server/db";
import { saveCurrentTenancy, startNewTenancy } from "@/server/compliance/records";

export type ActionResult = { ok: true } | { ok: false; error: string };

interface TenancyInput {
  propertyId: string;
  kind: string;
  startDate: string | null;
  writtenTermsProvidedOn: string | null;
  informationProvidedOn: string | null;
}

function normalize(input: TenancyInput) {
  return {
    kind: input.kind || "PERIODIC_ASSURED",
    startDate: input.startDate || null,
    writtenTermsProvidedOn: input.writtenTermsProvidedOn || null,
    informationProvidedOn: input.informationProvidedOn || null,
  };
}

function revalidate(propertyId: string) {
  revalidatePath(`/properties/${propertyId}/tenancy`);
  revalidatePath(`/properties/${propertyId}/essentials`);
}

export async function saveCurrentTenancyAction(input: TenancyInput): Promise<ActionResult> {
  const session = await getSession();
  if (!session) return { ok: false, error: "Not signed in." };
  await saveCurrentTenancy(prisma, session.account.id, input.propertyId, normalize(input));
  revalidate(input.propertyId);
  return { ok: true };
}

export async function startNewTenancyAction(input: TenancyInput): Promise<ActionResult> {
  const session = await getSession();
  if (!session) return { ok: false, error: "Not signed in." };
  if (!input.startDate) return { ok: false, error: "Enter the new tenancy's start date." };
  await startNewTenancy(prisma, session.account.id, input.propertyId, normalize(input));
  revalidate(input.propertyId);
  return { ok: true };
}
