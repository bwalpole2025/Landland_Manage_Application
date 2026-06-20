import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, publicProcedure } from "@/server/trpc";
import {
  AuthError,
  registerUser,
  requestPasswordReset,
  resetPassword,
  verifyEmail,
} from "@/server/auth/service";

const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .max(200);

export const authRouter = router({
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
