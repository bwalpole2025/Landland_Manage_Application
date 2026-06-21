// Bank-feed polling: pulls new transactions from the BankFeedProvider and
// imports them idempotently (deduped on externalId).
import type { Job } from "bullmq";
import { prisma } from "@/server/db";
import { providers } from "@/server/providers";
import { recordAudit } from "@/server/security/audit";

export async function processBankFeedPoll(job: Job<{ bankAccountId: string }>): Promise<void> {
  const bank = await prisma.bankAccount.findUnique({ where: { id: job.data.bankAccountId } });
  if (!bank || bank.status !== "CONNECTED") return;

  const since = bank.lastSyncedAt?.toISOString().slice(0, 10);
  const incoming = await providers.bankFeed.fetchTransactions(bank.id, since);

  let imported = 0;
  for (const t of incoming) {
    const result = await prisma.transaction.upsert({
      where: { accountId_externalId: { accountId: bank.accountId, externalId: t.externalId } },
      update: {},
      create: {
        accountId: bank.accountId,
        bankAccountId: bank.id,
        date: new Date(t.date),
        direction: t.direction,
        amountMinor: t.amountMinor,
        currency: t.currency,
        description: t.description,
        source: "BANK_FEED",
        reconciled: false,
        externalId: t.externalId,
      },
    });
    if (result.createdAt.getTime() === result.updatedAt.getTime()) imported += 1;
  }

  await prisma.bankAccount.update({ where: { id: bank.id }, data: { lastSyncedAt: new Date() } });

  if (imported > 0) {
    await recordAudit({
      accountId: bank.accountId,
      action: "CREATE",
      entity: "transaction",
      summary: `Imported ${imported} transaction(s) from ${bank.bankName} bank feed`,
      metadata: { bankAccountId: bank.id, imported },
    });
  }
  // eslint-disable-next-line no-console
  console.info(`[feed-poll] ${bank.bankName}: imported ${imported} new transactions`);
}
