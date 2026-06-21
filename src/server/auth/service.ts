// Auth orchestration: registration, login, email verification, password reset.
// Deliberately free of next/headers so it is unit-testable in plain Node.

import { prisma } from "@/server/db";
import { providers } from "@/server/providers";
import { env } from "@/server/env";
import { now as clockNow } from "@/lib/clock";
import { trialEndFrom } from "@/lib/subscription";
import { hashPassword, verifyPassword } from "./password";
import { verifyTotp } from "./totp";
import { decryptSecret } from "@/server/security/encryption";
import {
  createEmailVerificationToken,
  consumeEmailVerificationToken,
  createPasswordResetToken,
  consumePasswordResetToken,
} from "./tokens";

export type AuthErrorCode =
  | "EMAIL_TAKEN"
  | "INVALID_CREDENTIALS"
  | "EMAIL_NOT_VERIFIED"
  | "TOTP_REQUIRED"
  | "TOTP_INVALID"
  | "NO_ACCOUNT";

export class AuthError extends Error {
  constructor(public code: AuthErrorCode) {
    super(code);
    this.name = "AuthError";
  }
}

export interface RegisterInput {
  name: string;
  email: string;
  password: string;
}

function splitName(name: string): { firstName: string; lastName: string } {
  const parts = name.trim().split(/\s+/);
  return { firstName: parts[0] ?? name, lastName: parts.slice(1).join(" ") };
}

/**
 * Create a user, their home account, an owner membership, and the account's
 * default personal portfolio; then email a verify link.
 */
export async function registerUser(input: RegisterInput): Promise<{ userId: string }> {
  const email = input.email.toLowerCase().trim();
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) throw new AuthError("EMAIL_TAKEN");

  const passwordHash = await hashPassword(input.password);
  const { firstName, lastName } = splitName(input.name);

  const user = await prisma.$transaction(async (tx) => {
    const account = await tx.account.create({
      data: {
        name: `${input.name}'s account`,
        type: "INDIVIDUAL",
        // Every new account starts a 30-day free trial.
        subscriptionStatus: "TRIALING",
        trialEndsAt: trialEndFrom(clockNow()),
      },
    });
    const created = await tx.user.create({
      data: { email, firstName, lastName, passwordHash, accountId: account.id, role: "OWNER" },
    });
    await tx.membership.create({
      data: { userId: created.id, accountId: account.id, role: "OWNER" },
    });
    // Every account starts with one default personal portfolio.
    await tx.portfolio.create({
      data: { accountId: account.id, name: "Personal — Default", type: "PERSONAL", isDefault: true },
    });
    return created;
  });

  await sendVerificationEmail(user.id, email);
  return { userId: user.id };
}

/** Issue a fresh verification token and email the welcome/verify link. */
export async function sendVerificationEmail(userId: string, email: string): Promise<void> {
  const token = await createEmailVerificationToken(userId);
  await providers.mailer.send({
    to: email,
    subject: "Verify your Landland email",
    text: `Welcome to Landland! Confirm your email: ${env.appUrl}/verify?token=${token}`,
  });
}

/**
 * Resend the welcome/verification email. Resolves silently whether or not the
 * email exists or is already verified, so it never reveals account state.
 */
export async function resendVerification(email: string): Promise<void> {
  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase().trim() } });
  if (!user || user.emailVerified) return;
  await sendVerificationEmail(user.id, user.email);
}

export async function verifyEmail(rawToken: string): Promise<boolean> {
  const userId = await consumeEmailVerificationToken(rawToken);
  if (!userId) return false;
  await prisma.user.update({ where: { id: userId }, data: { emailVerified: new Date() } });
  return true;
}

export interface LoginInput {
  email: string;
  password: string;
  totp?: string;
}

/** Verify credentials (+TOTP if enabled) and resolve the account to activate. */
export async function authenticate(input: LoginInput): Promise<{ userId: string; activeAccountId: string }> {
  const email = input.email.toLowerCase().trim();
  const user = await prisma.user.findUnique({
    where: { email },
    include: { memberships: { orderBy: { createdAt: "asc" } } },
  });
  if (!user) throw new AuthError("INVALID_CREDENTIALS");

  const ok = await verifyPassword(input.password, user.passwordHash);
  if (!ok) throw new AuthError("INVALID_CREDENTIALS");
  if (!user.emailVerified) throw new AuthError("EMAIL_NOT_VERIFIED");

  if (user.twoFactorEnabled) {
    if (!input.totp) throw new AuthError("TOTP_REQUIRED");
    if (!user.totpSecret || !verifyTotp(input.totp, decryptSecret(user.totpSecret))) {
      throw new AuthError("TOTP_INVALID");
    }
  }

  const membership = user.memberships[0];
  if (!membership) throw new AuthError("NO_ACCOUNT");
  return { userId: user.id, activeAccountId: membership.accountId };
}

/** Always resolves — never reveals whether an email exists. */
export async function requestPasswordReset(email: string): Promise<void> {
  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase().trim() } });
  if (!user) return;
  const token = await createPasswordResetToken(user.id);
  await providers.mailer.send({
    to: user.email,
    subject: "Reset your Landland password",
    text: `Reset your password: ${env.appUrl}/reset?token=${token}`,
  });
}

export async function resetPassword(rawToken: string, newPassword: string): Promise<boolean> {
  const userId = await consumePasswordResetToken(rawToken);
  if (!userId) return false;
  const passwordHash = await hashPassword(newPassword);
  await prisma.$transaction([
    prisma.user.update({ where: { id: userId }, data: { passwordHash } }),
    // Revoke existing sessions on password change.
    prisma.session.deleteMany({ where: { userId } }),
  ]);
  return true;
}
