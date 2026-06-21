// Maps the per-account NotificationPreference row (+ the legacy Account email
// flags) to and from the pure NotificationPreferences shape used everywhere
// else. The Account.notificationEmails / marketingEmails columns remain the
// source of truth for the email master switch and the marketing opt-in, so the
// existing settings UI stays consistent.

import type { PrismaClient } from "@prisma/client";
import { DEFAULT_PREFERENCES, type NotificationPreferences } from "@/lib/notifications";

export async function loadPreferences(
  prisma: PrismaClient,
  accountId: string,
): Promise<NotificationPreferences> {
  const [pref, account] = await Promise.all([
    prisma.notificationPreference.findUnique({ where: { accountId } }),
    prisma.account.findUnique({
      where: { id: accountId },
      select: { marketingEmails: true, notificationEmails: true },
    }),
  ]);

  const marketingEmails = account?.marketingEmails ?? DEFAULT_PREFERENCES.marketingEmails;

  if (!pref) {
    // No explicit row yet — derive from the account's legacy email switch.
    return {
      channels: { email: account?.notificationEmails ?? true, in_app: true, push: false },
      categories: { ...DEFAULT_PREFERENCES.categories },
      marketingEmails,
    };
  }

  return {
    channels: { email: pref.emailEnabled, in_app: pref.inAppEnabled, push: pref.pushEnabled },
    categories: {
      document_expiry: pref.documentExpiry,
      arrears: pref.arrears,
      rent_reminder: pref.rentReminders,
      bank_feed: pref.bankFeed,
      mtd_deadline: pref.mtdDeadlines,
    },
    marketingEmails,
  };
}

export async function savePreferences(
  prisma: PrismaClient,
  accountId: string,
  prefs: NotificationPreferences,
): Promise<void> {
  const row = {
    emailEnabled: prefs.channels.email,
    inAppEnabled: prefs.channels.in_app,
    pushEnabled: prefs.channels.push,
    documentExpiry: prefs.categories.document_expiry,
    arrears: prefs.categories.arrears,
    rentReminders: prefs.categories.rent_reminder,
    bankFeed: prefs.categories.bank_feed,
    mtdDeadlines: prefs.categories.mtd_deadline,
  };

  await prisma.$transaction([
    prisma.notificationPreference.upsert({
      where: { accountId },
      create: { accountId, ...row },
      update: row,
    }),
    // Keep the legacy Account flags in sync so the rest of the app agrees.
    prisma.account.update({
      where: { id: accountId },
      data: { marketingEmails: prefs.marketingEmails, notificationEmails: prefs.channels.email },
    }),
  ]);
}
