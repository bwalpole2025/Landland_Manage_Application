"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Badge } from "@/components/ui";
import { trpc } from "@/lib/trpc/client";
import { formatChargeDate, planPriceLabel } from "@/lib/subscription";
import { SettingsCard, Labeled, StatusLine } from "./parts";
import type { SettingsAccount } from "./types";

// --- Time zone + first tax year ---------------------------------------------

export function LocaleSection({
  account,
  taxYearOptions,
}: {
  account: SettingsAccount;
  taxYearOptions: string[];
}) {
  const router = useRouter();
  const timeZones = useMemo(() => Intl.supportedValuesOf("timeZone"), []);
  const [timeZone, setTimeZone] = useState(account.timeZone);
  const [firstTaxYear, setFirstTaxYear] = useState(account.firstTaxYear ?? taxYearOptions[0]);
  const [status, setStatus] = useState<{ kind: "ok" | "err"; message: string } | null>(null);
  const update = trpc.settings.update.useMutation();

  const dirty = timeZone !== account.timeZone || firstTaxYear !== (account.firstTaxYear ?? taxYearOptions[0]);

  async function save() {
    setStatus(null);
    try {
      await update.mutateAsync({ timeZone, firstTaxYear });
      setStatus({ kind: "ok", message: "Saved." });
      router.refresh();
    } catch (err) {
      setStatus({ kind: "err", message: err instanceof Error ? err.message : "Could not save." });
    }
  }

  return (
    <SettingsCard
      title="Locale & tax"
      description="Your time zone and the earliest tax year you want to reconcile from."
      footer={
        <>
          <StatusLine status={status} />
          <Button onClick={save} disabled={!dirty || update.isPending}>
            {update.isPending ? "Saving…" : "Save changes"}
          </Button>
        </>
      }
    >
      <Labeled label="Time zone">
        <select className="input" value={timeZone} onChange={(e) => setTimeZone(e.target.value)}>
          {timeZones.map((tz) => (
            <option key={tz} value={tz}>
              {tz}
            </option>
          ))}
        </select>
      </Labeled>
      <Labeled label="First tax year">
        <select className="input max-w-[12rem]" value={firstTaxYear} onChange={(e) => setFirstTaxYear(e.target.value)}>
          {taxYearOptions.map((ty) => (
            <option key={ty} value={ty}>
              {ty}
            </option>
          ))}
        </select>
      </Labeled>
      <p className="text-xs text-slate-400">
        Landland will let you reconcile transactions and produce statements from {firstTaxYear} onwards.
      </p>
    </SettingsCard>
  );
}

// --- Subscription ------------------------------------------------------------

export function SubscriptionSection() {
  const router = useRouter();
  const summary = trpc.billing.summary.useQuery();
  const createCheckout = trpc.billing.createCheckout.useMutation();
  const cancel = trpc.billing.cancelScheduled.useMutation();
  const utils = trpc.useUtils();
  const [status, setStatus] = useState<{ kind: "ok" | "err"; message: string } | null>(null);

  async function onSubscribe() {
    setStatus(null);
    try {
      // Hand off to the provider's hosted checkout (collects the card off-site).
      const result = await createCheckout.mutateAsync({ returnUrl: "/settings?subscribed=1" });
      if (result?.url) window.location.href = result.url;
    } catch (err) {
      setStatus({ kind: "err", message: err instanceof Error ? err.message : "Could not start checkout." });
    }
  }

  async function onCancel() {
    setStatus(null);
    try {
      await cancel.mutateAsync();
      await utils.billing.summary.invalidate();
      router.refresh();
      setStatus({ kind: "ok", message: "Scheduled subscription canceled — you're back on the trial." });
    } catch (err) {
      setStatus({ kind: "err", message: err instanceof Error ? err.message : "Could not cancel." });
    }
  }

  if (!summary.data) {
    return (
      <SettingsCard title="Subscription" description="Loading your subscription…">
        <div className="h-10 animate-pulse rounded bg-slate-100" />
      </SettingsCard>
    );
  }

  const v = summary.data;
  const card = v.paymentMethod ? `${v.paymentMethod.brand} •••• ${v.paymentMethod.last4}` : null;
  const firstCharge = v.firstChargeDate ? formatChargeDate(v.firstChargeDate) : null;

  const badge =
    v.effectiveStatus === "active" ? (
      <Badge tone="success">Active</Badge>
    ) : v.effectiveStatus === "scheduled" ? (
      <Badge tone="success">Subscribed</Badge>
    ) : v.effectiveStatus === "trialing" ? (
      <Badge tone="info">Free trial</Badge>
    ) : v.effectiveStatus === "past_due" ? (
      <Badge tone="danger">Past due</Badge>
    ) : (
      <Badge tone="neutral">Canceled</Badge>
    );

  const subscribing = createCheckout.isPending;

  return (
    <SettingsCard
      title="Subscription"
      badge={badge}
      description={`Landland Pro — ${planPriceLabel()}.`}
      footer={
        v.effectiveStatus === "trialing" || v.effectiveStatus === "past_due" || v.effectiveStatus === "canceled" ? (
          <>
            <StatusLine status={status} />
            <Button onClick={onSubscribe} disabled={subscribing}>
              {subscribing ? "Redirecting…" : "Subscribe — add a payment method"}
            </Button>
          </>
        ) : v.effectiveStatus === "scheduled" ? (
          <>
            <StatusLine status={status} />
            <Button variant="secondary" onClick={onCancel} disabled={cancel.isPending}>
              {cancel.isPending ? "Canceling…" : "Cancel subscription"}
            </Button>
          </>
        ) : (
          <StatusLine status={status} />
        )
      }
    >
      {v.effectiveStatus === "trialing" ? (
        <p className="text-sm text-slate-700">
          You&apos;re on a free trial — <strong>{v.daysLeft} day{v.daysLeft === 1 ? "" : "s"} left</strong>
          {v.trialEndsAt ? <> (ends {formatChargeDate(v.trialEndsAt)})</> : null}. Subscribe now to unlock
          everything — you keep full access during the trial and{" "}
          <strong>your first payment of {planPriceLabel().split(" / ")[0]} is on {firstCharge}</strong>, the day
          your trial ends.
        </p>
      ) : v.effectiveStatus === "scheduled" ? (
        <p className="text-sm text-slate-700">
          You&apos;re subscribed to Landland Pro 🎉 Full access is unlocked now. Your first payment of{" "}
          <strong>{planPriceLabel().split(" / ")[0]}</strong> will be taken on <strong>{firstCharge}</strong>
          {card ? <> using {card}</> : null}. You won&apos;t be charged before then.
        </p>
      ) : v.effectiveStatus === "active" ? (
        <p className="text-sm text-slate-700">
          Your subscription is active — {planPriceLabel()}{card ? <>, billed to {card}</> : null}. Thanks for using
          Landland!
        </p>
      ) : v.effectiveStatus === "past_due" ? (
        <p className="text-sm text-red-700">Your last payment failed. Re-subscribe to restore full access.</p>
      ) : (
        <p className="text-sm text-slate-700">Your subscription is canceled. Subscribe again any time.</p>
      )}
    </SettingsCard>
  );
}

// Marketing & notification preferences now live in their own richer component:
// see NotificationPreferencesSection.tsx (channel × category matrix).
