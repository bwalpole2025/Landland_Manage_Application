import { router, accountProcedure } from "@/server/trpc";

export const dashboardRouter = router({
  // DB-backed portfolio summary, scoped to the session's account.
  summary: accountProcedure.query(async ({ ctx }) => {
    const accountId = ctx.accountId;

    const [propertyCount, activeTenancies, unreconciled, openObligations] = await Promise.all([
      ctx.prisma.property.count({ where: { accountId, deletedAt: null } }),
      ctx.prisma.tenancy.findMany({
        where: { accountId, status: "ACTIVE", deletedAt: null },
        select: { rentMinor: true, rentFrequency: true },
      }),
      ctx.prisma.transaction.count({ where: { accountId, reconciled: false, deactivated: false } }),
      ctx.prisma.mtdObligation.count({ where: { accountId, status: "OPEN" } }),
    ]);

    const rentRollMinor = activeTenancies.reduce(
      (sum, t) => sum + (t.rentFrequency === "WEEKLY" ? Math.round((t.rentMinor * 52) / 12) : t.rentMinor),
      0,
    );

    return {
      propertyCount,
      occupiedCount: activeTenancies.length,
      rentRollMinor,
      currency: "GBP",
      unreconciledCount: unreconciled,
      openObligationCount: openObligations,
    };
  }),
});
