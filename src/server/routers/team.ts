import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, accountProcedure } from "@/server/trpc";
import { createInvitation, listTeam, revokeInvitation, InvitationError } from "@/server/auth/invitations";

const ownerOnly = accountProcedure.use(({ ctx, next }) => {
  if (ctx.session.role !== "owner") {
    throw new TRPCError({ code: "FORBIDDEN", message: "Only the account owner can manage the team." });
  }
  return next();
});

export const teamRouter = router({
  list: ownerOnly.query(({ ctx }) => listTeam(ctx.accountId)),

  invite: ownerOnly
    .input(
      z.object({
        email: z.string().email(),
        role: z.enum(["ASSISTANT", "ACCOUNTANT"]),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      try {
        await createInvitation(ctx.accountId, ctx.session.user.id, input.email, input.role);
        return { ok: true };
      } catch (err) {
        if (err instanceof InvitationError) throw new TRPCError({ code: "BAD_REQUEST", message: err.message });
        throw err;
      }
    }),

  revoke: ownerOnly
    .input(z.object({ invitationId: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      await revokeInvitation(ctx.accountId, input.invitationId);
      return { ok: true };
    }),
});
