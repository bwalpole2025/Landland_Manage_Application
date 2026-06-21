// Preference resolution — the single rule that decides whether a (category,
// channel) pair is enabled. Pure and side-effect-free so it is trivially unit
// tested and shared by the planner, the dispatcher and the UI.

import {
  NOTIFICATION_CHANNELS,
  type NotificationCategory,
  type NotificationChannel,
  type NotificationPreferences,
} from "./types";

/**
 * Sensible defaults for a new account: email + in-app on, push off (no device
 * registered yet), every category on, marketing off (separate opt-in).
 */
export const DEFAULT_PREFERENCES: NotificationPreferences = {
  channels: { email: true, in_app: true, push: false },
  categories: {
    document_expiry: true,
    arrears: true,
    rent_reminder: true,
    bank_feed: true,
    mtd_deadline: true,
  },
  marketingEmails: false,
};

/**
 * The core rule: a notification fires on a channel for a category iff the
 * channel is on *and* the category is on. Disabling either suppresses it.
 */
export function isDeliveryEnabled(
  prefs: NotificationPreferences,
  category: NotificationCategory,
  channel: NotificationChannel,
): boolean {
  return Boolean(prefs.channels[channel] && prefs.categories[category]);
}

/** The channels a given category should be delivered on, in canonical order. */
export function enabledChannelsFor(
  prefs: NotificationPreferences,
  category: NotificationCategory,
): NotificationChannel[] {
  return NOTIFICATION_CHANNELS.filter((channel) => isDeliveryEnabled(prefs, category, channel));
}
