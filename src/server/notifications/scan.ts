// The single entrypoint every scheduled job calls. For one account it:
//   1. resolves "today" in the account's time zone,
//   2. gathers domain data and builds NotificationEvents (optionally filtered to
//      a subset of categories),
//   3. loads preferences and the already-sent ledger,
//   4. plans the deliveries (exactly one per enabled channel, none re-sent),
//   5. dispatches them.

import type { PrismaClient } from "@prisma/client";
import { todayInZone } from "@/lib/calendar";
import {
  collectNotificationEvents,
  deliveryKey,
  planDeliveries,
  type NotificationCategory,
  type NotificationChannel,
} from "@/lib/notifications";
import { prisma as defaultPrisma } from "@/server/db";
import { providers as defaultProviders, type Providers } from "@/server/providers";
import { dispatchPlanned, type DispatchResult } from "./dispatch";
import { gatherTriggerInput } from "./gather";
import { loadPreferences } from "./preferences";
import { resolveRecipients } from "./recipients";

const PRISMA_CHANNEL: Record<string, NotificationChannel> = {
  EMAIL: "email",
  IN_APP: "in_app",
  PUSH: "push",
};

export interface ScanOptions {
  categories?: NotificationCategory[];
  prisma?: PrismaClient;
  providers?: Providers;
}

export interface ScanSummary extends DispatchResult {
  accountId: string;
  events: number;
  planned: number;
}

export async function runNotificationScan(
  accountId: string,
  opts: ScanOptions = {},
): Promise<ScanSummary> {
  const prisma = opts.prisma ?? defaultPrisma;
  const providers = opts.providers ?? defaultProviders;

  const account = await prisma.account.findUnique({
    where: { id: accountId },
    select: { timeZone: true },
  });
  const today = todayInZone(account?.timeZone ?? "Europe/London");

  const input = await gatherTriggerInput(prisma, accountId, today);
  const events = collectNotificationEvents(input, today, opts.categories);

  if (events.length === 0) {
    return { accountId, events: 0, planned: 0, created: 0, emailed: 0, pushed: 0, inApp: 0 };
  }

  const [prefs, recipients, ledgerRows] = await Promise.all([
    loadPreferences(prisma, accountId),
    resolveRecipients(prisma, accountId),
    prisma.notification.findMany({
      where: { accountId, dedupeKey: { in: events.map((e) => e.dedupeKey) } },
      select: { dedupeKey: true, channel: true },
    }),
  ]);

  const alreadySent = ledgerRows.map((r) => deliveryKey(r.dedupeKey, PRISMA_CHANNEL[r.channel]));
  const planned = planDeliveries(events, prefs, alreadySent);

  const dispatched = await dispatchPlanned(prisma, providers, accountId, recipients, planned);
  return { accountId, events: events.length, planned: planned.length, ...dispatched };
}

/** Run the scan for every account — used by the daily fan-out scheduler. */
export async function runNotificationScanForAllAccounts(
  opts: ScanOptions = {},
): Promise<ScanSummary[]> {
  const prisma = opts.prisma ?? defaultPrisma;
  const accounts = await prisma.account.findMany({ select: { id: true } });
  const summaries: ScanSummary[] = [];
  for (const a of accounts) {
    summaries.push(await runNotificationScan(a.id, opts));
  }
  return summaries;
}
