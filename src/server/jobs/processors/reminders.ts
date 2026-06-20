// Compliance document expiry reminders (30 / 14 / 7 / 1 days before).
import type { Job } from "bullmq";
import { prisma } from "@/server/db";
import { providers } from "@/server/providers";

const THRESHOLD_DAYS = [30, 14, 7, 1];
const DAY = 24 * 60 * 60 * 1000;

export async function processComplianceReminders(job: Job<{ accountId?: string }>): Promise<void> {
  const now = new Date();
  const horizon = new Date(now.getTime() + 30 * DAY);

  const docs = await prisma.document.findMany({
    where: {
      ...(job.data.accountId ? { accountId: job.data.accountId } : {}),
      expiryDate: { not: null, lte: horizon },
    },
    include: { property: true },
  });

  let sent = 0;
  for (const doc of docs) {
    if (!doc.expiryDate) continue;
    const days = Math.ceil((doc.expiryDate.getTime() - now.getTime()) / DAY);
    if (days >= 0 && THRESHOLD_DAYS.includes(days)) {
      await providers.mailer.send({
        to: "landlord@account.local", // a real impl resolves the account owners
        subject: `Reminder: ${doc.title} expires in ${days} day(s)`,
        text: `${doc.title} for ${doc.property?.nickname ?? "your portfolio"} expires on ${doc.expiryDate.toDateString()}.`,
      });
      sent += 1;
    }
  }
  // eslint-disable-next-line no-console
  console.info(`[reminders] scanned ${docs.length} docs, sent ${sent} reminders`);
}
