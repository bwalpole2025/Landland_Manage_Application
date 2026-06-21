// BullMQ queue wiring. Jobs degrade gracefully: when REDIS_URL is unset (CI,
// most local dev) the queues are disabled and enqueue calls become logged
// no-ops, so the app and tests never require Redis.

import { Queue } from "bullmq";
import { Redis } from "ioredis";
import { env } from "@/server/env";

export const QUEUE_NAMES = {
  reminders: "reminders",
  arrears: "arrears",
  feedPoll: "feed-poll",
  notifications: "notifications",
} as const;

// The repeatable, account-fan-out job that drives the daily notification scan.
export const DAILY_DISPATCH_JOB = "daily-fan-out";
// 07:00 every day (worker/server time). Each account's day boundary is still
// resolved in its own time zone inside the scan.
export const DAILY_DISPATCH_CRON = "0 7 * * *";

let connection: Redis | null = null;

export function getConnection(): Redis | null {
  if (!env.redisUrl) return null;
  if (!connection) {
    connection = new Redis(env.redisUrl, { maxRetriesPerRequest: null });
  }
  return connection;
}

export const jobsEnabled = Boolean(env.redisUrl);

function makeQueue(name: string): Queue | null {
  const conn = getConnection();
  return conn ? new Queue(name, { connection: conn }) : null;
}

const queues = {
  reminders: makeQueue(QUEUE_NAMES.reminders),
  arrears: makeQueue(QUEUE_NAMES.arrears),
  feedPoll: makeQueue(QUEUE_NAMES.feedPoll),
  notifications: makeQueue(QUEUE_NAMES.notifications),
};

async function add(queue: Queue | null, jobName: string, data: unknown): Promise<void> {
  if (!queue) {
    // eslint-disable-next-line no-console
    console.warn(`[jobs] ${jobName} skipped — REDIS_URL not configured`);
    return;
  }
  await queue.add(jobName, data);
}

// Public enqueue helpers — safe to call from anywhere in the app.
export const enqueue = {
  complianceReminderScan: (accountId: string) =>
    add(queues.reminders, "compliance-reminder-scan", { accountId }),
  arrearsDetection: (accountId: string) =>
    add(queues.arrears, "arrears-detection", { accountId }),
  bankFeedPoll: (bankAccountId: string) =>
    add(queues.feedPoll, "bank-feed-poll", { bankAccountId }),
  // Full multi-category notification scan for one account (e.g. on demand).
  notificationScan: (accountId: string) =>
    add(queues.notifications, "notification-scan", { accountId }),
};

/**
 * Register the repeatable daily scan. Idempotent — BullMQ dedupes repeatable
 * jobs by (name + repeat options), so calling this on every worker boot is safe.
 * No-op when Redis is not configured.
 */
export async function registerRepeatableSchedules(): Promise<void> {
  if (!queues.notifications) {
    // eslint-disable-next-line no-console
    console.warn("[jobs] schedules skipped — REDIS_URL not configured");
    return;
  }
  await queues.notifications.add(
    DAILY_DISPATCH_JOB,
    {},
    { repeat: { pattern: DAILY_DISPATCH_CRON }, removeOnComplete: true, removeOnFail: 100 },
  );
}
