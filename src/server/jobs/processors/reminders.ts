// Compliance document expiry reminders (30 / 14 / 7 / 1 days before). Delegates
// to the unified notification scan, scoped to the document-expiry category, so
// channel fan-out, preferences and exactly-once delivery are handled centrally.
import type { Job } from "bullmq";
import { runNotificationScan, runNotificationScanForAllAccounts } from "@/server/notifications";

export async function processComplianceReminders(job: Job<{ accountId?: string }>): Promise<void> {
  const categories = ["document_expiry"] as const;
  if (job.data.accountId) {
    const s = await runNotificationScan(job.data.accountId, { categories: [...categories] });
    // eslint-disable-next-line no-console
    console.info(`[reminders] account ${s.accountId}: ${s.created} document reminders sent`);
    return;
  }
  const all = await runNotificationScanForAllAccounts({ categories: [...categories] });
  const created = all.reduce((sum, s) => sum + s.created, 0);
  // eslint-disable-next-line no-console
  console.info(`[reminders] ${all.length} account(s): ${created} document reminders sent`);
}
