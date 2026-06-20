"use server";

import { revalidatePath } from "next/cache";
import { createReminder, completeReminder, reopenReminder, clearCompletedReminders } from "@/services/repository";
import { now } from "@/lib/clock";
import { providers } from "@/server/providers";

export interface CreateReminderInput {
  name: string;
  description?: string;
  dueDate: string;
  propertyId?: string;
  tenancyId?: string;
}

/** Create a reminder. It appears under "My work" and on the calendar, and a
 * notification can be triggered ahead of the due date. */
export async function createReminderAction(input: CreateReminderInput): Promise<void> {
  createReminder(input);
  // A real impl schedules this; here we log via the mailer provider.
  await providers.mailer.send({
    to: "landlord@account.local",
    subject: `Reminder set: ${input.name}`,
    text: `Due ${input.dueDate}. ${input.description ?? ""}`.trim(),
  });
  revalidatePath("/files/reminders");
  revalidatePath("/files/calendar");
}

export async function completeReminderAction(id: string): Promise<void> {
  completeReminder(id, now().toISOString());
  revalidatePath("/files/reminders");
  revalidatePath("/files/calendar");
}

export async function reopenReminderAction(id: string): Promise<void> {
  reopenReminder(id);
  revalidatePath("/files/reminders");
  revalidatePath("/files/calendar");
}

export async function clearCompletedRemindersAction(): Promise<void> {
  clearCompletedReminders();
  revalidatePath("/files/reminders");
}
