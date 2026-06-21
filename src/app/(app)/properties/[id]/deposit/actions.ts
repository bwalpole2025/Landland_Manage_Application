"use server";

import { revalidatePath } from "next/cache";
import { getSession } from "@/server/auth/session";
import { prisma } from "@/server/db";
import { saveDeposit } from "@/server/compliance/records";

export type ActionResult = { ok: true } | { ok: false; error: string };

export async function saveDepositAction(input: {
  propertyId: string;
  scheme: string | null;
  depositGBP: number | null;
  receivedOn: string | null;
  protectedOn: string | null;
  prescribedInfoServedOn: string | null;
}): Promise<ActionResult> {
  const session = await getSession();
  if (!session) return { ok: false, error: "Not signed in." };

  await saveDeposit(prisma, session.account.id, input.propertyId, {
    scheme: input.scheme || null,
    depositGBP: input.depositGBP,
    receivedOn: input.receivedOn || null,
    protectedOn: input.protectedOn || null,
    prescribedInfoServedOn: input.prescribedInfoServedOn || null,
  });

  revalidatePath(`/properties/${input.propertyId}/deposit`);
  revalidatePath(`/properties/${input.propertyId}/essentials`); // statuses may change
  return { ok: true };
}
