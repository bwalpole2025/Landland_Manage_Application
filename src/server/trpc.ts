// tRPC initialisation, request context, and the procedure hierarchy:
//   publicProcedure     → anyone
//   protectedProcedure  → authenticated (ctx.session is non-null)
//   accountProcedure    → authenticated + tenant-scoped (ctx.accountId)
//
// accountProcedure is where multi-tenant isolation is enforced: every business
// query/mutation derives its accountId from the session, never from the client.

import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import { ZodError } from "zod";
// Type-only import: keeps next/headers out of this module's runtime graph so the
// router can be imported (and unit-tested) outside a Next request.
import type { AppSession } from "@/server/auth/session";
import { prisma } from "@/server/db";

export interface TRPCContext {
  session: AppSession | null;
  prisma: typeof prisma;
}

const t = initTRPC.context<TRPCContext>().create({
  transformer: superjson,
  errorFormatter({ shape, error }) {
    return {
      ...shape,
      data: {
        ...shape.data,
        zodError: error.cause instanceof ZodError ? error.cause.flatten() : null,
      },
    };
  },
});

export const router = t.router;
export const publicProcedure = t.procedure;

const requireSession = t.middleware(({ ctx, next }) => {
  if (!ctx.session) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "Not signed in" });
  }
  return next({ ctx: { session: ctx.session } });
});

export const protectedProcedure = t.procedure.use(requireSession);

/** Tenant-scoped: guarantees ctx.accountId from the session. */
export const accountProcedure = protectedProcedure.use(({ ctx, next }) => {
  return next({ ctx: { accountId: ctx.session.account.id } });
});
