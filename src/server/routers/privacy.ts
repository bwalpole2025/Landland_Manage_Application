import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, accountProcedure } from "@/server/trpc";
import { listAudit } from "@/server/security/audit";
import { deleteAccount } from "@/server/security/gdpr";
import { clearSession } from "@/server/auth/session";

const ownerOnly = accountProcedure.use(({ ctx, next }) => {
  if (ctx.session.role !== "owner") {
    throw new TRPCError({ code: "FORBIDDEN", message: "Only the account owner can do this." });
  }
  return next();
});

export const privacyRouter = router({
  // Audit trail — financial changes & external submissions (owner/accountant).
  audit: accountProcedure
    .input(z.object({ limit: z.number().min(1).max(200).optional() }).optional())
    .query(({ ctx, input }) => listAudit(ctx.prisma, ctx.accountId, input?.limit ?? 100)),

  // Right to erasure. Requires the owner to type the exact account name.
  deleteAccount: ownerOnly
    .input(z.object({ confirmName: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const account = await ctx.prisma.account.findUniqueOrThrow({ where: { id: ctx.accountId } });
      if (input.confirmName.trim() !== account.name) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "The account name does not match." });
      }
      await deleteAccount(ctx.prisma, ctx.accountId, ctx.session.user.id);
      await clearSession();
      return { ok: true };
    }),
});
