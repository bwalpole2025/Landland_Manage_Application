// Rent arrears detection: compares rent due over a rolling window against rent
// received per active tenancy and flags shortfalls.
import type { Job } from "bullmq";
import { prisma } from "@/server/db";

const WINDOW_MONTHS = 3;

export async function processArrearsDetection(job: Job<{ accountId?: string }>): Promise<void> {
  const now = new Date();
  const windowStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (WINDOW_MONTHS - 1), 1));

  const tenancies = await prisma.tenancy.findMany({
    where: {
      ...(job.data.accountId ? { accountId: job.data.accountId } : {}),
      status: "ACTIVE",
      deletedAt: null,
    },
  });

  let inArrears = 0;
  for (const tenancy of tenancies) {
    const received = await prisma.transaction.aggregate({
      where: {
        tenancyId: tenancy.id,
        direction: "INCOME",
        category: "RENT",
        date: { gte: windowStart },
      },
      _sum: { amountMinor: true },
    });

    // Months elapsed in the window whose due-day has passed.
    let dueMonths = 0;
    for (let i = 0; i < WINDOW_MONTHS; i++) {
      const due = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, tenancy.rentDueDay));
      if (due <= now && due >= windowStart) dueMonths += 1;
    }
    const expected = dueMonths * tenancy.rentMinor;
    const balance = expected - (received._sum.amountMinor ?? 0);
    if (balance >= tenancy.rentMinor / 2) {
      inArrears += 1;
      // A real impl would create an alert / notify; here we just record the signal.
    }
  }
  // eslint-disable-next-line no-console
  console.info(`[arrears] checked ${tenancies.length} tenancies, ${inArrears} in arrears`);
}
