import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, accountProcedure } from "@/server/trpc";
import {
  listInbox,
  loadPreferences,
  markAllRead,
  markRead,
  registerPushDevice,
  savePreferences,
  unreadCount,
} from "@/server/notifications";
import type { NotificationPreferences } from "@/lib/notifications";

const ownerOnly = accountProcedure.use(({ ctx, next }) => {
  if (ctx.session.role !== "owner") {
    throw new TRPCError({ code: "FORBIDDEN", message: "Only the account owner can change this." });
  }
  return next();
});

const updateInput = z
  .object({
    channels: z
      .object({ email: z.boolean(), in_app: z.boolean(), push: z.boolean() })
      .partial(),
    categories: z
      .object({
        document_expiry: z.boolean(),
        arrears: z.boolean(),
        rent_reminder: z.boolean(),
        bank_feed: z.boolean(),
        mtd_deadline: z.boolean(),
      })
      .partial(),
    marketingEmails: z.boolean(),
  })
  .partial();

export const notificationsRouter = router({
  // --- Preferences ---------------------------------------------------------
  preferences: accountProcedure.query(({ ctx }) => loadPreferences(ctx.prisma, ctx.accountId)),

  updatePreferences: ownerOnly.input(updateInput).mutation(async ({ ctx, input }) => {
    const current = await loadPreferences(ctx.prisma, ctx.accountId);
    const next: NotificationPreferences = {
      channels: { ...current.channels, ...input.channels },
      categories: { ...current.categories, ...input.categories },
      marketingEmails: input.marketingEmails ?? current.marketingEmails,
    };
    await savePreferences(ctx.prisma, ctx.accountId, next);
    return next;
  }),

  // --- In-app inbox --------------------------------------------------------
  list: accountProcedure
    .input(z.object({ limit: z.number().min(1).max(100).optional() }).optional())
    .query(({ ctx, input }) => listInbox(ctx.prisma, ctx.accountId, input?.limit ?? 50)),

  unreadCount: accountProcedure.query(({ ctx }) => unreadCount(ctx.prisma, ctx.accountId)),

  markRead: accountProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await markRead(ctx.prisma, ctx.accountId, input.id);
      return { ok: true };
    }),

  markAllRead: accountProcedure.mutation(async ({ ctx }) => {
    await markAllRead(ctx.prisma, ctx.accountId);
    return { ok: true };
  }),

  // --- Push device registration -------------------------------------------
  registerPushDevice: accountProcedure
    .input(z.object({ token: z.string().min(8), platform: z.enum(["web", "ios", "android"]).default("web") }))
    .mutation(async ({ ctx, input }) => {
      await registerPushDevice(ctx.prisma, ctx.accountId, ctx.session.user.id, input.token, input.platform);
      return { ok: true };
    }),
});
