// Notification scan processor. Handles both the repeatable daily fan-out (scan
// every account) and on-demand single-account scans.
import type { Job } from "bullmq";
import { DAILY_DISPATCH_JOB } from "@/server/jobs/queue";
import { runNotificationScan, runNotificationScanForAllAccounts } from "@/server/notifications";

export async function processNotifications(job: Job<{ accountId?: string }>): Promise<void> {
  if (job.name === DAILY_DISPATCH_JOB || !job.data.accountId) {
    const summaries = await runNotificationScanForAllAccounts();
    const created = summaries.reduce((sum, s) => sum + s.created, 0);
    // eslint-disable-next-line no-console
    console.info(`[notifications] daily scan: ${summaries.length} account(s), ${created} delivered`);
    return;
  }

  const summary = await runNotificationScan(job.data.accountId);
  // eslint-disable-next-line no-console
  console.info(
    `[notifications] account ${summary.accountId}: ${summary.planned} planned, ${summary.created} delivered`,
  );
}
