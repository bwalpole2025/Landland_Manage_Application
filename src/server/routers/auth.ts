import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, publicProcedure } from "@/server/trpc";
import {
  AuthError,
  registerUser,
  requestPasswordReset,
  resendVerification,
  resetPassword,
  verifyEmail,
} from "@/server/auth/service";
import { passwordSchema } from "@/server/validators";
import { previewInvitation } from "@/server/auth/invitations";

export const authRouter = router({
  // Look up a pending invitation by token, to render the accept page.
  invitationPreview: publicProcedure
    .input(z.object({ token: z.string().min(1) }))
    .query(async ({ input }) => previewInvitation(input.token)),

  register: publicProcedure
    .input(
      z.object({
        name: z.string().min(1).max(120),
        email: z.string().email(),
        password: passwordSchema,
      }),
    )
    .mutation(async ({ input }) => {
      try {
        await registerUser(input);
        return { ok: true };
      } catch (err) {
        if (err instanceof AuthError && err.code === "EMAIL_TAKEN") {
          throw new TRPCError({ code: "CONFLICT", message: "That email is already registered" });
        }
        throw err;
      }
    }),

  verifyEmail: publicProcedure
    .input(z.object({ token: z.string().min(1) }))
    .mutation(async ({ input }) => ({ ok: await verifyEmail(input.token) })),

  resendVerification: publicProcedure
    .input(z.object({ email: z.string().email() }))
    .mutation(async ({ input }) => {
      await resendVerification(input.email);
      return { ok: true }; // never reveal whether the email exists / is verified
    }),

  requestPasswordReset: publicProcedure
    .input(z.object({ email: z.string().email() }))
    .mutation(async ({ input }) => {
      await requestPasswordReset(input.email);
      return { ok: true }; // never reveal whether the email exists
    }),

  resetPassword: publicProcedure
    .input(z.object({ token: z.string().min(1), password: passwordSchema }))
    .mutation(async ({ input }) => ({ ok: await resetPassword(input.token, input.password) })),
});
