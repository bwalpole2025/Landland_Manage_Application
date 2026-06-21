// Billing orchestration: turns a hosted-checkout completion into a scheduled or
// active subscription. Pure-ish and provider-injected so it can be unit tested.

import type { PrismaClient } from "@prisma/client";
import type { PaymentProvider } from "@/server/providers";
import { now as clockNow } from "@/lib/clock";
import { recordAudit } from "@/server/security/audit";
import { projectedFirstCharge, subscriptionView, type SubscriptionView } from "@/lib/subscription";

export class BillingError extends Error {
  constructor(
    public code: "TERMS_REQUIRED" | "CHECKOUT_INCOMPLETE" | "NOT_FOUND",
    message: string,
  ) {
    super(message);
    this.name = "BillingError";
  }
}

type AccountBilling = {
  subscriptionStatus: "TRIALING" | "ACTIVE" | "PAST_DUE" | "CANCELED";
  trialEndsAt: Date | null;
  billingStartsAt: Date | null;
};

export function viewForAccount(account: AccountBilling, now: Date = clockNow()): SubscriptionView {
  return subscriptionView(
    {
      status: account.subscriptionStatus,
      trialEndsAt: account.trialEndsAt ? account.trialEndsAt.toISOString() : null,
      billingStartsAt: account.billingStartsAt ? account.billingStartsAt.toISOString() : null,
    },
    now,
  );
}

/** Begin a hosted checkout and return the URL to send the owner to. */
export async function startCheckout(
  prisma: PrismaClient,
  provider: PaymentProvider,
  accountId: string,
  returnUrl: string,
): Promise<{ url: string; sessionId: string }> {
  const [account, owner] = await Promise.all([
    prisma.account.findUnique({ where: { id: accountId }, select: { trialEndsAt: true } }),
    prisma.user.findFirst({
      where: { accountId, role: "OWNER" },
      orderBy: { createdAt: "asc" },
      select: { email: true },
    }),
  ]);
  const session = await provider.createCheckout({
    accountId,
    customerEmail: owner?.email ?? "",
    returnUrl,
    trialEndsAt: account?.trialEndsAt ? account.trialEndsAt.toISOString() : null,
  });
  return { url: session.url, sessionId: session.id };
}

/**
 * Finalise a completed checkout. Requires explicit terms acceptance (never
 * auto-accepted). Schedules billing for the end of the trial (keeping the
 * account entitled immediately) or activates at once if the trial has ended.
 */
export async function completeCheckout(
  prisma: PrismaClient,
  provider: PaymentProvider,
  accountId: string,
  input: { sessionId: string; termsAccepted: boolean },
): Promise<SubscriptionView> {
  if (!input.termsAccepted) {
    throw new BillingError("TERMS_REQUIRED", "You must accept the terms to subscribe.");
  }

  const result = await provider.retrieveCheckout(input.sessionId);
  if (result.status !== "complete") {
    throw new BillingError("CHECKOUT_INCOMPLETE", "Checkout was not completed.");
  }

  const account = await prisma.account.findUnique({ where: { id: accountId } });
  if (!account) throw new BillingError("NOT_FOUND", "Account not found.");

  const now = clockNow();
  const trialOngoing = account.trialEndsAt != null && account.trialEndsAt.getTime() > now.getTime();
  const firstCharge = projectedFirstCharge(
    account.trialEndsAt ? account.trialEndsAt.toISOString() : null,
    now,
  );

  const updated = await prisma.account.update({
    where: { id: accountId },
    data: {
      // Inside the trial → keep TRIALING (scheduled); past the trial → ACTIVE now.
      subscriptionStatus: trialOngoing ? "TRIALING" : "ACTIVE",
      billingStartsAt: firstCharge,
      paymentMethodBrand: result.paymentMethod?.brand ?? null,
      paymentMethodLast4: result.paymentMethod?.last4 ?? null,
      billingCustomerId: result.customerId ?? null,
      billingSubscriptionId: result.subscriptionId ?? null,
      termsAcceptedAt: now,
    },
  });

  await recordAudit(
    {
      accountId,
      action: "UPDATE",
      entity: "subscription",
      entityId: result.subscriptionId ?? null,
      summary: `Subscribed to Landland Pro — billing scheduled for ${firstCharge.toISOString().slice(0, 10)}`,
      metadata: { paymentMethod: result.paymentMethod, termsAccepted: true },
    },
    prisma,
  );

  return viewForAccount(updated, now);
}

/** Cancel a scheduled (not-yet-charged) subscription, reverting to the trial. */
export async function cancelScheduled(prisma: PrismaClient, accountId: string): Promise<SubscriptionView> {
  const updated = await prisma.account.update({
    where: { id: accountId },
    data: {
      subscriptionStatus: "TRIALING",
      billingStartsAt: null,
      billingSubscriptionId: null,
    },
  });
  return viewForAccount(updated);
}
