import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, accountProcedure } from "@/server/trpc";
import { providers } from "@/server/providers";
import {
  BillingError,
  cancelScheduled,
  completeCheckout,
  startCheckout,
  viewForAccount,
} from "@/server/billing/service";

const ownerOnly = accountProcedure.use(({ ctx, next }) => {
  if (ctx.session.role !== "owner") {
    throw new TRPCError({ code: "FORBIDDEN", message: "Only the account owner can manage billing." });
  }
  return next();
});

function toTRPC(err: unknown): never {
  if (err instanceof BillingError) {
    const code = err.code === "NOT_FOUND" ? "NOT_FOUND" : "BAD_REQUEST";
    throw new TRPCError({ code, message: err.message });
  }
  throw err;
}

export const billingRouter = router({
  // Current subscription/trial view for the active account.
  summary: accountProcedure.query(async ({ ctx }) => {
    const account = await ctx.prisma.account.findUniqueOrThrow({
      where: { id: ctx.accountId },
      select: { subscriptionStatus: true, trialEndsAt: true, billingStartsAt: true, paymentMethodBrand: true, paymentMethodLast4: true },
    });
    return {
      ...viewForAccount(account),
      paymentMethod:
        account.paymentMethodBrand && account.paymentMethodLast4
          ? { brand: account.paymentMethodBrand, last4: account.paymentMethodLast4 }
          : null,
    };
  }),

  // Begin hosted checkout; returns the URL to redirect the owner to.
  createCheckout: ownerOnly
    .input(z.object({ returnUrl: z.string().default("/settings?subscribed=1") }).optional())
    .mutation(async ({ ctx, input }) => {
      try {
        return await startCheckout(
          ctx.prisma,
          providers.payments,
          ctx.accountId,
          input?.returnUrl ?? "/settings?subscribed=1",
        );
      } catch (err) {
        toTRPC(err);
      }
    }),

  // Finalise a completed checkout. termsAccepted must be explicitly true.
  completeCheckout: ownerOnly
    .input(z.object({ sessionId: z.string().min(1), termsAccepted: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      try {
        return await completeCheckout(ctx.prisma, providers.payments, ctx.accountId, input);
      } catch (err) {
        toTRPC(err);
      }
    }),

  // Cancel a scheduled (not-yet-billed) subscription.
  cancelScheduled: ownerOnly.mutation(({ ctx }) => cancelScheduled(ctx.prisma, ctx.accountId)),
});
