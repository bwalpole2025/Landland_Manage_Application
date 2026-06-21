// Notification domain types — the vocabulary shared by the pure planning core
// (triggers + planner), the server dispatcher and the UI. Kept dependency-free
// so it imports cleanly into the worker, the tRPC layer and the browser.

/** Where a notification can be delivered. */
export type NotificationChannel = "email" | "in_app" | "push";

export const NOTIFICATION_CHANNELS: NotificationChannel[] = ["email", "in_app", "push"];

/** What a notification is about. Each maps to one scheduled-job trigger. */
export type NotificationCategory =
  | "document_expiry"
  | "arrears"
  | "rent_reminder"
  | "bank_feed"
  | "mtd_deadline";

export const NOTIFICATION_CATEGORIES: NotificationCategory[] = [
  "document_expiry",
  "arrears",
  "rent_reminder",
  "bank_feed",
  "mtd_deadline",
];

export const CATEGORY_LABELS: Record<NotificationCategory, string> = {
  document_expiry: "Certificate & document expiry",
  arrears: "Rent arrears",
  rent_reminder: "Upcoming rent payments",
  bank_feed: "Bank feed & consent",
  mtd_deadline: "MTD quarterly deadlines",
};

export const CHANNEL_LABELS: Record<NotificationChannel, string> = {
  email: "Email",
  in_app: "In-app",
  push: "Mobile / push",
};

/**
 * A landlord's notification preferences. A notification for a given category is
 * delivered on a given channel only when *both* the channel and the category are
 * enabled. Marketing email is a separate opt-in, never implied by the above.
 */
export interface NotificationPreferences {
  channels: Record<NotificationChannel, boolean>;
  categories: Record<NotificationCategory, boolean>;
  marketingEmails: boolean;
}

/**
 * A single thing worth telling the landlord about, produced by a trigger. The
 * `dedupeKey` is the stable identity of this *exact* occurrence (e.g. "the 7-day
 * reminder for document X") so that repeated scans never raise it twice.
 */
export interface NotificationEvent {
  dedupeKey: string;
  category: NotificationCategory;
  title: string;
  body: string;
  href: string;
  /** ISO date the event concerns (for display / sorting). */
  date?: string;
}

/** An event fanned out to one enabled channel — the unit the dispatcher sends. */
export interface PlannedDelivery extends NotificationEvent {
  channel: NotificationChannel;
}
