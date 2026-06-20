import { router, protectedProcedure } from "@/server/trpc";

export const accountRouter = router({
  // The current user + active account, straight from the session.
  me: protectedProcedure.query(({ ctx }) => {
    return {
      user: ctx.session.user,
      account: ctx.session.account,
      role: ctx.session.role,
      isDelegated: ctx.session.isDelegated,
    };
  }),
});
