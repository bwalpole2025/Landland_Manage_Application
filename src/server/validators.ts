import { z } from "zod";

/** Minimum password policy, shared across auth and profile flows. */
export const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .max(200);

/** 6-digit one-time code (TOTP / SMS). */
export const otpSchema = z
  .string()
  .trim()
  .regex(/^\d{6}$/, "Enter the 6-digit code");
