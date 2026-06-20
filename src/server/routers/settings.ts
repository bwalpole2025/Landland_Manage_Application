import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, accountProcedure } from "@/server/trpc";

const IANA_ZONES = new Set(Intl.supportedValuesOf("timeZone"));

/** "2026/27"-style UK tax year. */
const taxYearSchema = z.string().regex(/^\d{4}\/\d{2}$/, "Pick a tax year");

const ownerOnly = accountProcedure.use(({ ctx, next }) => {
  if (ctx.session.role !== "owner") {
    throw new TRPCError({ code: "FORBIDDEN", message: "Only the account owner can change this." });
  }
  return next();
});

export const settingsRouter = router({
  // Time zone, first tax year, and marketing/notification preferences.
  update: ownerOnly
    .input(
      z
        .object({
          timeZone: z.string().refine((tz) => IANA_ZONES.has(tz), "Unknown time zone"),
          firstTaxYear: taxYearSchema,
          marketingEmails: z.boolean(),
          notificationEmails: z.boolean(),
        })
        .partial(),
    )
    .mutation(async ({ ctx, input }) => {
      await ctx.prisma.account.update({ where: { id: ctx.accountId }, data: input });
      return { ok: true };
    }),

  // Activate the subscription (ends the trial).
  activateSubscription: ownerOnly.mutation(async ({ ctx }) => {
    await ctx.prisma.account.update({
      where: { id: ctx.accountId },
      data: { subscriptionStatus: "ACTIVE" },
    });
    return { ok: true };
  }),
});
