// Trial & subscription model — the single source of truth for "what is this
// account entitled to right now". Pure and clock-injectable so it backs the
// banner, the access gates, the settings screen and the tests identically.
//
// Model
//   - A new account gets a 30-day free trial (status TRIALING, trialEndsAt set).
//   - During the trial premium features are GATED until the owner commits to a
//     subscription. Committing schedules billing for the *end* of the trial, so
//     the account keeps full access immediately and is not charged until then.
//   - `billingStartsAt` being set is the commitment signal: the account becomes
//     entitled even while still inside the trial window ("scheduled").
//   - When the first-charge date passes, billing is live ("active").

import { now as clockNow } from "./clock";

export const TRIAL_LENGTH_DAYS = 30;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** The single paid plan. Prices are integer minor units (pence). */
export const PLAN = {
  name: "PropManage Pro",
  priceMinor: 1200,
  currency: "GBP",
  interval: "month" as const,
};

export type RawSubscriptionStatus = "TRIALING" | "ACTIVE" | "PAST_DUE" | "CANCELED";
export type EffectiveStatus = "trialing" | "scheduled" | "active" | "past_due" | "canceled";

export interface SubscriptionInput {
  status: RawSubscriptionStatus;
  /** ISO datetime the trial ends (null if never on trial). */
  trialEndsAt: string | null;
  /** ISO datetime billing is scheduled to start (set once the owner subscribes). */
  billingStartsAt: string | null;
}

export type BannerState =
  | { kind: "trial"; daysLeft: number; trialEndsAt: string }
  | { kind: "scheduled"; firstChargeDate: string }
  | { kind: "trial_ended" }
  | { kind: "past_due" };

export interface SubscriptionView {
  effectiveStatus: EffectiveStatus;
  /** True when premium features/data are unlocked. */
  entitled: boolean;
  trialActive: boolean;
  /** Whole days remaining in the trial (0 when none / expired). */
  daysLeft: number;
  trialEndsAt: string | null;
  /** ISO datetime of the first charge (or projected first charge during trial). */
  firstChargeDate: string | null;
  banner: BannerState | null;
}

/** Trial end = start + 30 days. */
export function trialEndFrom(startedAt: Date): Date {
  return new Date(startedAt.getTime() + TRIAL_LENGTH_DAYS * MS_PER_DAY);
}

function ceilDaysBetween(from: Date, to: Date): number {
  return Math.max(0, Math.ceil((to.getTime() - from.getTime()) / MS_PER_DAY));
}

/**
 * The projected first-charge date for an account that subscribes *now*: the end
 * of the trial, or today if the trial has already ended (billing starts at once).
 */
export function projectedFirstCharge(trialEndsAt: string | null, now: Date = clockNow()): Date {
  if (!trialEndsAt) return now;
  const end = new Date(trialEndsAt);
  return end.getTime() > now.getTime() ? end : now;
}

export function subscriptionView(input: SubscriptionInput, now: Date = clockNow()): SubscriptionView {
  const trialEnd = input.trialEndsAt ? new Date(input.trialEndsAt) : null;
  const billingStart = input.billingStartsAt ? new Date(input.billingStartsAt) : null;
  const trialOngoing = trialEnd != null && trialEnd.getTime() > now.getTime();

  let effectiveStatus: EffectiveStatus;
  if (input.status === "ACTIVE") {
    effectiveStatus = "active";
  } else if (input.status === "PAST_DUE") {
    effectiveStatus = "past_due";
  } else if (input.status === "CANCELED") {
    effectiveStatus = "canceled";
  } else if (billingStart != null) {
    // Subscribed during the trial: scheduled until the charge date, then active.
    effectiveStatus = now.getTime() >= billingStart.getTime() ? "active" : "scheduled";
  } else {
    effectiveStatus = "trialing";
  }

  const entitled = effectiveStatus === "active" || effectiveStatus === "scheduled";
  const daysLeft = trialEnd ? ceilDaysBetween(now, trialEnd) : 0;

  const firstChargeDate =
    effectiveStatus === "scheduled" && billingStart
      ? billingStart.toISOString()
      : effectiveStatus === "trialing"
        ? projectedFirstCharge(input.trialEndsAt, now).toISOString()
        : null;

  let banner: BannerState | null = null;
  if (effectiveStatus === "trialing") {
    banner = trialOngoing
      ? { kind: "trial", daysLeft, trialEndsAt: input.trialEndsAt! }
      : { kind: "trial_ended" };
  } else if (effectiveStatus === "scheduled" && billingStart) {
    banner = { kind: "scheduled", firstChargeDate: billingStart.toISOString() };
  } else if (effectiveStatus === "past_due") {
    banner = { kind: "past_due" };
  }

  return {
    effectiveStatus,
    entitled,
    trialActive: effectiveStatus === "trialing" && trialOngoing,
    daysLeft,
    trialEndsAt: input.trialEndsAt,
    firstChargeDate,
    banner,
  };
}

// --- Formatting helpers (shared by banner, settings, checkout) --------------

/** "4 July 2026" — the long, unambiguous form used in billing copy. */
export function formatChargeDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

/** "£12.00 / month". */
export function planPriceLabel(): string {
  const amount = (PLAN.priceMinor / 100).toLocaleString("en-GB", {
    style: "currency",
    currency: PLAN.currency,
  });
  return `${amount} / ${PLAN.interval}`;
}
