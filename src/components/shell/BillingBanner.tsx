"use client";

import type { BannerState } from "@/lib/subscription";
import { formatChargeDate } from "@/lib/subscription";

/**
 * Persistent, dismissible billing banner shown across the app. Renders the
 * trial countdown, a "subscription scheduled" confirmation, or a past-due
 * warning depending on the account's subscription state.
 */
export function BillingBanner({ banner, onDismiss }: { banner: BannerState; onDismiss: () => void }) {
  if (banner.kind === "scheduled") {
    return (
      <Bar tone="success" onDismiss={onDismiss}>
        You&apos;re subscribed to PropManage Pro — full access is unlocked. Your first payment is on{" "}
        <strong>{formatChargeDate(banner.firstChargeDate)}</strong>.
      </Bar>
    );
  }

  if (banner.kind === "past_due") {
    return (
      <Bar tone="danger" onDismiss={onDismiss}>
        Your last payment failed. <a href="/settings#subscription" className="font-semibold underline underline-offset-2">Update your payment method</a> to restore full access.
      </Bar>
    );
  }

  if (banner.kind === "trial_ended") {
    return (
      <Bar tone="warning" onDismiss={onDismiss}>
        Your free trial has ended. <a href="/settings#subscription" className="font-semibold underline underline-offset-2">Subscribe</a> to unlock your data again.
      </Bar>
    );
  }

  // trial
  const days = Math.max(0, banner.daysLeft);
  return (
    <Bar tone="warning" onDismiss={onDismiss}>
      You have <strong>{days} {days === 1 ? "day" : "days"} left</strong> in your free trial. Some features are
      restricted until you{" "}
      <a href="/settings#subscription" className="font-semibold underline underline-offset-2 hover:text-warning-900">
        add a payment method
      </a>
      .
    </Bar>
  );
}

const TONES = {
  warning: "border-warning-200 bg-warning-50 text-warning-800",
  success: "border-success-200 bg-success-50 text-success-800",
  danger: "border-danger-200 bg-danger-50 text-danger-800",
} as const;

const GLYPH_TONE = {
  warning: "text-warning-600",
  success: "text-success-600",
  danger: "text-danger-600",
} as const;

function Bar({
  tone,
  onDismiss,
  children,
}: {
  tone: keyof typeof TONES;
  onDismiss: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className={`flex items-center gap-3 border-b px-4 py-2.5 text-sm lg:px-6 ${TONES[tone]}`}>
      <span aria-hidden className={`select-none font-bold ${GLYPH_TONE[tone]}`}>
        {tone === "success" ? "✓" : tone === "danger" ? "⚠" : "⚠"}
      </span>
      <p className="min-w-0 flex-1">{children}</p>
      <button
        onClick={onDismiss}
        aria-label="Dismiss banner"
        className="shrink-0 rounded p-1 hover:bg-black/5"
      >
        ✕
      </button>
    </div>
  );
}
