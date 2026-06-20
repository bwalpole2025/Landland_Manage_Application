import { router, protectedProcedure } from "@/server/trpc";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { otpSchema } from "@/server/validators";
import {
  beginTotpEnrolment,
  confirmTotpEnrolment,
  disableTwoFactor,
  TwoFactorError,
} from "@/server/auth/twofactor";

function mapError(err: unknown): never {
  if (err instanceof TwoFactorError) throw new TRPCError({ code: "BAD_REQUEST", message: err.message });
  throw err;
}

export const securityRouter = router({
  // Step 1 — stage a secret and return the otpauth URI for a QR code.
  beginTotp: protectedProcedure.mutation(async ({ ctx }) => {
    try {
      return await beginTotpEnrolment(ctx.session.user.id);
    } catch (err) {
      mapError(err);
    }
  }),

  // Step 2 — verify a live code, then enable 2FA.
  confirmTotp: protectedProcedure
    .input(z.object({ code: otpSchema }))
    .mutation(async ({ ctx, input }) => {
      try {
        await confirmTotpEnrolment(ctx.session.user.id, input.code);
        return { ok: true };
      } catch (err) {
        mapError(err);
      }
    }),

  disableTotp: protectedProcedure
    .input(z.object({ code: otpSchema }))
    .mutation(async ({ ctx, input }) => {
      try {
        await disableTwoFactor(ctx.session.user.id, input.code);
        return { ok: true };
      } catch (err) {
        mapError(err);
      }
    }),
});
