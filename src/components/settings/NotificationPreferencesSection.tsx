"use client";

import { useEffect, useState } from "react";
import { trpc } from "@/lib/trpc/client";
import {
  CATEGORY_LABELS,
  CHANNEL_LABELS,
  NOTIFICATION_CATEGORIES,
  NOTIFICATION_CHANNELS,
  type NotificationCategory,
  type NotificationChannel,
  type NotificationPreferences,
} from "@/lib/notifications";
import { SettingsCard, Switch, StatusLine } from "./parts";

type PreferencePatch = {
  channels?: Partial<Record<NotificationChannel, boolean>>;
  categories?: Partial<Record<NotificationCategory, boolean>>;
  marketingEmails?: boolean;
};

const CATEGORY_HINTS: Record<(typeof NOTIFICATION_CATEGORIES)[number], string> = {
  document_expiry: "Gas, EICR, EPC and insurance certificates nearing expiry (30/14/7/1 days).",
  arrears: "When received rent falls short of what's due.",
  rent_reminder: "A heads-up a few days before each rent payment is due.",
  bank_feed: "Reconnect prompts and Open Banking consent expiry.",
  mtd_deadline: "Making Tax Digital quarterly update deadlines.",
};

export function NotificationPreferencesSection() {
  const utils = trpc.useUtils();
  const query = trpc.notifications.preferences.useQuery();
  const update = trpc.notifications.updatePreferences.useMutation();
  const [prefs, setPrefs] = useState<NotificationPreferences | null>(null);
  const [status, setStatus] = useState<{ kind: "ok" | "err"; message: string } | null>(null);

  useEffect(() => {
    if (query.data) setPrefs(query.data);
  }, [query.data]);

  async function persist(patch: PreferencePatch, optimistic: NotificationPreferences) {
    setPrefs(optimistic);
    setStatus(null);
    try {
      const saved = await update.mutateAsync(patch);
      setPrefs(saved);
      setStatus({ kind: "ok", message: "Preferences saved." });
      await utils.notifications.preferences.invalidate();
    } catch (err) {
      setPrefs(query.data ?? null); // roll back
      setStatus({ kind: "err", message: err instanceof Error ? err.message : "Could not save." });
    }
  }

  if (!prefs) {
    return (
      <SettingsCard title="Notifications" description="Loading your notification preferences…">
        <div className="h-10 animate-pulse rounded bg-slate-100" />
      </SettingsCard>
    );
  }

  const setChannel = (ch: (typeof NOTIFICATION_CHANNELS)[number], v: boolean) =>
    persist({ channels: { [ch]: v } }, { ...prefs, channels: { ...prefs.channels, [ch]: v } });

  const setCategory = (cat: (typeof NOTIFICATION_CATEGORIES)[number], v: boolean) =>
    persist({ categories: { [cat]: v } }, { ...prefs, categories: { ...prefs.categories, [cat]: v } });

  return (
    <SettingsCard
      title="Manage notification preferences"
      description="Choose how Landland alerts you. A notification is sent on a channel only when both the channel and the topic below are on."
      footer={<StatusLine status={status} />}
    >
      {/* Channels */}
      <div>
        <p className="mb-2 text-sm font-semibold text-slate-800">Channels</p>
        <div className="space-y-3">
          {NOTIFICATION_CHANNELS.map((ch) => (
            <Switch
              key={ch}
              label={CHANNEL_LABELS[ch]}
              description={
                ch === "push" ? "Requires a registered mobile/web device." : undefined
              }
              checked={prefs.channels[ch]}
              disabled={update.isPending}
              onChange={(v) => setChannel(ch, v)}
            />
          ))}
        </div>
      </div>

      <div className="h-px bg-slate-100" />

      {/* Categories */}
      <div>
        <p className="mb-2 text-sm font-semibold text-slate-800">What to notify me about</p>
        <div className="space-y-3">
          {NOTIFICATION_CATEGORIES.map((cat) => (
            <Switch
              key={cat}
              label={CATEGORY_LABELS[cat]}
              description={CATEGORY_HINTS[cat]}
              checked={prefs.categories[cat]}
              disabled={update.isPending}
              onChange={(v) => setCategory(cat, v)}
            />
          ))}
        </div>
      </div>

      <div className="h-px bg-slate-100" />

      {/* Marketing — separate opt-in */}
      <div>
        <p className="mb-2 text-sm font-semibold text-slate-800">Marketing</p>
        <Switch
          label="Product & marketing emails"
          description="Tips, new features and occasional offers. Separate from the alerts above."
          checked={prefs.marketingEmails}
          disabled={update.isPending}
          onChange={(v) => persist({ marketingEmails: v }, { ...prefs, marketingEmails: v })}
        />
      </div>
    </SettingsCard>
  );
}
