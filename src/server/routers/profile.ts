import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "@/server/trpc";
import { passwordSchema, otpSchema } from "@/server/validators";
import { changePassword, ProfileError } from "@/server/auth/profile";
import { sendMobileCode, verifyMobileCode, MobileVerificationError } from "@/server/auth/mobile";
import { sendVerificationEmail } from "@/server/auth/service";

const phoneSchema = z
  .string()
  .trim()
  .min(7, "Enter a valid mobile number")
  .max(20)
  .regex(/^[+0-9 ()-]+$/, "Enter a valid mobile number");

export const profileRouter = router({
  // First name, last name, number of properties managed.
  update: protectedProcedure
    .input(
      z.object({
        firstName: z.string().trim().min(1, "First name is required").max(80),
        lastName: z.string().trim().min(1, "Last name is required").max(80),
        numberOfPropertiesManaged: z.number().int().min(0).max(100000),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await ctx.prisma.user.update({ where: { id: ctx.session.user.id }, data: input });
      return { ok: true };
    }),

  changePassword: protectedProcedure
    .input(z.object({ currentPassword: z.string().min(1), newPassword: passwordSchema }))
    .mutation(async ({ ctx, input }) => {
      try {
        await changePassword(ctx.session.user.id, input.currentPassword, input.newPassword);
        return { ok: true };
      } catch (err) {
        if (err instanceof ProfileError) throw new TRPCError({ code: "BAD_REQUEST", message: err.message });
        throw err;
      }
    }),

  // Re-send the welcome/verification email to the signed-in user.
  resendEmailVerification: protectedProcedure.mutation(async ({ ctx }) => {
    if (!ctx.session.user.emailVerified) {
      await sendVerificationEmail(ctx.session.user.id, ctx.session.user.email);
    }
    return { ok: true };
  }),

  sendMobileCode: protectedProcedure
    .input(z.object({ mobile: phoneSchema }))
    .mutation(async ({ ctx, input }) => {
      await sendMobileCode(ctx.session.user.id, input.mobile);
      return { ok: true };
    }),

  verifyMobileCode: protectedProcedure
    .input(z.object({ code: otpSchema }))
    .mutation(async ({ ctx, input }) => {
      try {
        await verifyMobileCode(ctx.session.user.id, input.code);
        return { ok: true };
      } catch (err) {
        if (err instanceof MobileVerificationError) throw new TRPCError({ code: "BAD_REQUEST", message: err.message });
        throw err;
      }
    }),
});
