"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Badge } from "@/components/ui";
import { trpc } from "@/lib/trpc/client";
import { SettingsCard, Labeled, Switch, StatusLine } from "./parts";
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

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
}

export function SubscriptionSection({ account }: { account: SettingsAccount }) {
  const router = useRouter();
  const [status, setStatus] = useState<{ kind: "ok" | "err"; message: string } | null>(null);
  const activate = trpc.settings.activateSubscription.useMutation();

  async function onActivate() {
    setStatus(null);
    try {
      await activate.mutateAsync();
      setStatus({ kind: "ok", message: "Subscription activated. Thank you!" });
      router.refresh();
    } catch (err) {
      setStatus({ kind: "err", message: err instanceof Error ? err.message : "Could not activate." });
    }
  }

  const { subscriptionStatus: s, trialEndsAt } = account;
  const trialDaysLeft =
    trialEndsAt != null
      ? Math.max(0, Math.ceil((new Date(trialEndsAt).getTime() - Date.now()) / 86_400_000))
      : null;

  const badge =
    s === "ACTIVE" ? (
      <Badge tone="success">Active</Badge>
    ) : s === "TRIALING" ? (
      <Badge tone="info">Trial</Badge>
    ) : s === "PAST_DUE" ? (
      <Badge tone="danger">Past due</Badge>
    ) : (
      <Badge tone="neutral">Canceled</Badge>
    );

  return (
    <SettingsCard
      title="Subscription"
      badge={badge}
      footer={
        s !== "ACTIVE" ? (
          <>
            <StatusLine status={status} />
            <Button onClick={onActivate} disabled={activate.isPending}>
              {activate.isPending ? "Activating…" : "Activate subscription"}
            </Button>
          </>
        ) : (
          <StatusLine status={status} />
        )
      }
    >
      {s === "TRIALING" && trialEndsAt ? (
        <p className="text-sm text-slate-700">
          You&apos;re on a free trial — <strong>{trialDaysLeft} day{trialDaysLeft === 1 ? "" : "s"} left</strong>.
          It ends on <strong>{formatDate(trialEndsAt)}</strong>. Activate now to keep access without interruption.
        </p>
      ) : s === "ACTIVE" ? (
        <p className="text-sm text-slate-700">Your subscription is active. Thanks for using Landland!</p>
      ) : s === "PAST_DUE" ? (
        <p className="text-sm text-red-700">Your last payment failed. Reactivate to restore full access.</p>
      ) : (
        <p className="text-sm text-slate-700">Your subscription is canceled. Reactivate any time.</p>
      )}
    </SettingsCard>
  );
}

// --- Marketing & notification preferences -----------------------------------

export function PreferencesSection({ account }: { account: SettingsAccount }) {
  const router = useRouter();
  const [marketing, setMarketing] = useState(account.marketingEmails);
  const [notifications, setNotifications] = useState(account.notificationEmails);
  const [status, setStatus] = useState<{ kind: "ok" | "err"; message: string } | null>(null);
  const update = trpc.settings.update.useMutation();

  async function persist(next: { marketingEmails?: boolean; notificationEmails?: boolean }) {
    setStatus(null);
    try {
      await update.mutateAsync(next);
      setStatus({ kind: "ok", message: "Preferences saved." });
      router.refresh();
    } catch (err) {
      setStatus({ kind: "err", message: err instanceof Error ? err.message : "Could not save." });
    }
  }

  return (
    <SettingsCard
      title="Notifications & marketing"
      description="Choose what Landland emails you about."
      footer={<StatusLine status={status} />}
    >
      <Switch
        label="Product & marketing emails"
        description="Tips, new features and occasional offers."
        checked={marketing}
        disabled={update.isPending}
        onChange={(v) => {
          setMarketing(v);
          persist({ marketingEmails: v });
        }}
      />
      <div className="h-px bg-slate-100" />
      <div>
        <p className="mb-2 text-sm font-semibold text-slate-800">Manage notification preferences</p>
        <Switch
          label="Account & deadline notifications"
          description="Rent arrears, certificate expiries and MTD deadlines."
          checked={notifications}
          disabled={update.isPending}
          onChange={(v) => {
            setNotifications(v);
            persist({ notificationEmails: v });
          }}
        />
      </div>
    </SettingsCard>
  );
}
