// Dispatches planned deliveries. Each delivery first claims a row in the
// Notification table; the unique (accountId, dedupeKey, channel) constraint is
// the idempotency gate — only a *newly inserted* row triggers the channel's
// side-effect (email / push). In-app delivery is the row itself. This is what
// guarantees "exactly one reminder per configured channel" even if a scan runs
// repeatedly or two workers race.

import { Prisma, type PrismaClient } from "@prisma/client";
import { appUrl } from "@/server/notifications/links";
import type { Providers } from "@/server/providers";
import type {
  NotificationCategory,
  NotificationChannel,
  PlannedDelivery,
} from "@/lib/notifications";
import type { Recipients } from "./recipients";

const CHANNEL_TO_PRISMA: Record<NotificationChannel, "EMAIL" | "IN_APP" | "PUSH"> = {
  email: "EMAIL",
  in_app: "IN_APP",
  push: "PUSH",
};

const CATEGORY_TO_PRISMA: Record<
  NotificationCategory,
  "DOCUMENT_EXPIRY" | "ARREARS" | "RENT_REMINDER" | "BANK_FEED" | "MTD_DEADLINE"
> = {
  document_expiry: "DOCUMENT_EXPIRY",
  arrears: "ARREARS",
  rent_reminder: "RENT_REMINDER",
  bank_feed: "BANK_FEED",
  mtd_deadline: "MTD_DEADLINE",
};

export interface DispatchResult {
  created: number;
  emailed: number;
  pushed: number;
  inApp: number;
}

function isUniqueViolation(err: unknown): boolean {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002";
}

export async function dispatchPlanned(
  prisma: PrismaClient,
  providers: Providers,
  accountId: string,
  recipients: Recipients,
  planned: PlannedDelivery[],
): Promise<DispatchResult> {
  const result: DispatchResult = { created: 0, emailed: 0, pushed: 0, inApp: 0 };

  for (const d of planned) {
    // Claim the delivery. If the row already exists, it has been sent before —
    // skip silently so nothing is delivered twice.
    let claimed = true;
    try {
      await prisma.notification.create({
        data: {
          accountId,
          userId: d.channel === "in_app" ? recipients.inboxUserId : null,
          category: CATEGORY_TO_PRISMA[d.category],
          channel: CHANNEL_TO_PRISMA[d.channel],
          dedupeKey: d.dedupeKey,
          title: d.title,
          body: d.body,
          href: d.href,
        },
      });
    } catch (err) {
      if (isUniqueViolation(err)) claimed = false;
      else throw err;
    }
    if (!claimed) continue;
    result.created += 1;

    // Fire the channel side-effect for the freshly-claimed delivery.
    if (d.channel === "email") {
      for (const to of recipients.emails) {
        await providers.mailer.send({
          to,
          subject: d.title,
          text: `${d.body}\n\nOpen Landland: ${appUrl(d.href)}`,
        });
      }
      result.emailed += 1;
    } else if (d.channel === "push") {
      if (recipients.pushTokens.length > 0) {
        await providers.push.send({
          tokens: recipients.pushTokens,
          title: d.title,
          body: d.body,
          url: appUrl(d.href),
        });
      }
      result.pushed += 1;
    } else {
      result.inApp += 1; // the inserted row is the in-app notification
    }
  }

  return result;
}
