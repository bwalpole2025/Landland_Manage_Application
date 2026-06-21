// Background worker entrypoint: `npm run worker`.
//
// Starts BullMQ workers for notifications, compliance reminders, arrears
// detection and bank-feed polling, and registers the repeatable daily scan.
// Exits cleanly when REDIS_URL is not set so it is safe to run in any
// environment.

import "dotenv/config";
import { Worker } from "bullmq";
import { getConnection, QUEUE_NAMES, registerRepeatableSchedules } from "./queue";
import { processNotifications } from "./processors/notifications";
import { processComplianceReminders } from "./processors/reminders";
import { processArrearsDetection } from "./processors/arrears";
import { processBankFeedPoll } from "./processors/feed-poll";

async function main() {
  const connection = getConnection();
  if (!connection) {
    // eslint-disable-next-line no-console
    console.warn("[worker] REDIS_URL not set — nothing to do. Set it to enable background jobs.");
    return;
  }

  const workers = [
    new Worker(QUEUE_NAMES.notifications, processNotifications, { connection }),
    new Worker(QUEUE_NAMES.reminders, processComplianceReminders, { connection }),
    new Worker(QUEUE_NAMES.arrears, processArrearsDetection, { connection }),
    new Worker(QUEUE_NAMES.feedPoll, processBankFeedPoll, { connection }),
  ];

  await registerRepeatableSchedules();

  // eslint-disable-next-line no-console
  console.info(`[worker] started ${workers.length} workers + daily notification schedule`);

  const shutdown = async () => {
    await Promise.all(workers.map((w) => w.close()));
    await connection.quit();
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((err) => {
  console.error("[worker] fatal", err);
  process.exit(1);
});
