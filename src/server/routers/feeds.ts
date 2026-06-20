import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "@/server/trpc";
import { providers } from "@/server/providers";

// Bank-feed ingestion behind the BankFeedProvider interface. In development this
// is the local Open-Banking sandbox; swap the concrete provider in providers/.
// We only ever hold the provider's opaque connection token — never credentials.
export const feedsRouter = router({
  // Step 1 — begin the Open Banking consent flow.
  connect: protectedProcedure
    .input(z.object({ institutionId: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      return providers.bankFeed.connect(ctx.session.account.id, input.institutionId);
    }),

  // Step 2 — after consent, list the connected account(s) and pull transactions.
  confirm: protectedProcedure
    .input(z.object({ connectionId: z.string().min(1) }))
    .mutation(async ({ input }) => {
      const accounts = await providers.bankFeed.listAccounts(input.connectionId);
      const account = accounts[0];
      if (!account) throw new TRPCError({ code: "NOT_FOUND", message: "No accounts on this connection" });
      const transactions = await providers.bankFeed.fetchTransactions(account.externalId);
      return { account, transactions };
    }),

  // Re-pull a connected account (manual "Sync now").
  sync: protectedProcedure
    .input(z.object({ externalAccountId: z.string().min(1), since: z.string().optional() }))
    .mutation(async ({ input }) => {
      return providers.bankFeed.fetchTransactions(input.externalAccountId, input.since);
    }),

  // Simulate a provider webhook push (a single new inbound transaction).
  simulateWebhook: protectedProcedure
    .input(z.object({ externalAccountId: z.string().min(1) }))
    .mutation(async ({ input }) => {
      if (!providers.bankFeed.simulateWebhookEvent) {
        throw new TRPCError({ code: "NOT_IMPLEMENTED", message: "Provider has no webhook simulation" });
      }
      return providers.bankFeed.simulateWebhookEvent(input.externalAccountId);
    }),
});
