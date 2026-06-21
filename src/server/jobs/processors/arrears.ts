// Rent arrears detection: compares rent due against rent received per active
// tenancy and raises an alert per tenancy in arrears. Delegates to the unified
// notification scan, scoped to the arrears category.
import type { Job } from "bullmq";
import { runNotificationScan, runNotificationScanForAllAccounts } from "@/server/notifications";

export async function processArrearsDetection(job: Job<{ accountId?: string }>): Promise<void> {
  const categories = ["arrears"] as const;
  if (job.data.accountId) {
    const s = await runNotificationScan(job.data.accountId, { categories: [...categories] });
    // eslint-disable-next-line no-console
    console.info(`[arrears] account ${s.accountId}: ${s.created} arrears alerts raised`);
    return;
  }
  const all = await runNotificationScanForAllAccounts({ categories: [...categories] });
  const created = all.reduce((sum, s) => sum + s.created, 0);
  // eslint-disable-next-line no-console
  console.info(`[arrears] ${all.length} account(s): ${created} arrears alerts raised`);
}
