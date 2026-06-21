"use server";

import { revalidatePath } from "next/cache";
import { getSession } from "@/server/auth/session";
import { prisma } from "@/server/db";
import { addManualReceipt, assessRentForProperty, removeReceipt, saveSchedule } from "@/server/compliance/rent";
import { todayISO } from "@/lib/dates";
import { now } from "@/lib/clock";
import type { ArrearsAssessment } from "@obligations-engine";

export type ActionResult = { ok: true } | { ok: false; error: string };

export async function saveScheduleAction(input: {
  propertyId: string;
  frequency: string;
  rentGBP: number | null;
  startDate: string | null;
  endDate: string | null;
}): Promise<ActionResult> {
  const session = await getSession();
  if (!session) return { ok: false, error: "Not signed in." };
  if (!input.rentGBP || input.rentGBP <= 0) return { ok: false, error: "Enter the rent amount." };
  if (!input.startDate) return { ok: false, error: "Enter the schedule start date." };

  await saveSchedule(prisma, session.account.id, input.propertyId, {
    frequency: input.frequency,
    rentGBP: input.rentGBP,
    startDate: input.startDate,
    endDate: input.endDate || null,
  });
  revalidatePath(`/properties/${input.propertyId}/rent`);
  return { ok: true };
}

export async function addReceiptAction(input: {
  propertyId: string;
  date: string | null;
  amountGBP: number | null;
  reference: string | null;
}): Promise<ActionResult> {
  const session = await getSession();
  if (!session) return { ok: false, error: "Not signed in." };
  if (!input.date) return { ok: false, error: "Enter the payment date." };
  if (!input.amountGBP || input.amountGBP <= 0) return { ok: false, error: "Enter the amount received." };

  await addManualReceipt(prisma, session.account.id, input.propertyId, {
    date: input.date,
    amountGBP: input.amountGBP,
    reference: input.reference || null,
  });
  revalidatePath(`/properties/${input.propertyId}/rent`);
  return { ok: true };
}

export async function removeReceiptAction(input: { propertyId: string; receiptId: string }): Promise<ActionResult> {
  const session = await getSession();
  if (!session) return { ok: false, error: "Not signed in." };
  await removeReceipt(prisma, session.account.id, input.receiptId);
  revalidatePath(`/properties/${input.propertyId}/rent`);
  return { ok: true };
}

/** Engine-derived Section 8 Ground 8 assessment at the notice + hearing stages. */
export async function assessGround8Action(input: {
  propertyId: string;
  noticeDate: string;
  hearingDate: string;
}): Promise<{ ok: true; assessment: ArrearsAssessment | null } | { ok: false; error: string }> {
  const session = await getSession();
  if (!session) return { ok: false, error: "Not signed in." };
  const view = await assessRentForProperty(prisma, session.account.id, input.propertyId, {
    asOf: todayISO(now()),
    noticeDate: input.noticeDate || undefined,
    hearingDate: input.hearingDate || undefined,
  });
  return { ok: true, assessment: view.assessment };
}
