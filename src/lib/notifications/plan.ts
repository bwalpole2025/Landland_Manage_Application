// The planner: turns a list of notification *events* into concrete *deliveries*,
// fanning each event out to its enabled channels while guaranteeing exactly one
// delivery per (event, channel). This is where the headline acceptance criterion
// lives — "a document expiring in 7 days triggers exactly one reminder per
// configured channel; disabling a preference suppresses it".

import { enabledChannelsFor } from "./preferences";
import type {
  NotificationChannel,
  NotificationEvent,
  NotificationPreferences,
  PlannedDelivery,
} from "./types";

/** Stable ledger key for a single delivery — `<dedupeKey>::<channel>`. */
export function deliveryKey(dedupeKey: string, channel: NotificationChannel): string {
  return `${dedupeKey}::${channel}`;
}

/**
 * Plan the deliveries to send right now.
 *
 * - Each event fans out to the channels enabled for its category.
 * - `alreadySent` is the set of `deliveryKey()`s previously dispatched (the
 *   idempotency ledger). Anything already there is skipped, so re-running a scan
 *   never double-sends — "exactly one per channel" holds across runs.
 * - Duplicates within a single batch are also collapsed.
 */
export function planDeliveries(
  events: NotificationEvent[],
  prefs: NotificationPreferences,
  alreadySent: Iterable<string> = [],
): PlannedDelivery[] {
  const sent = new Set(alreadySent);
  const planned: PlannedDelivery[] = [];

  for (const event of events) {
    for (const channel of enabledChannelsFor(prefs, event.category)) {
      const key = deliveryKey(event.dedupeKey, channel);
      if (sent.has(key)) continue;
      sent.add(key); // also collapses in-batch duplicates
      planned.push({ ...event, channel });
    }
  }

  return planned;
}
