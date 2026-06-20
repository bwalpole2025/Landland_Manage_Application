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
} as const;

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
};
