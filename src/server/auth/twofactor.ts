// TOTP two-factor enrolment orchestration.
//
// Enabling 2FA is a two-step handshake so we never flip `twoFactorEnabled` on a
// secret the user can't actually produce codes for:
//   1. begin   → generate a secret, store it (still disabled), return the QR URI
//   2. confirm → verify a live code against that secret, then enable
// Disabling requires a valid current code as a safety check.

import { prisma } from "@/server/db";
import { generateTotpSecret, totpKeyUri, verifyTotp } from "./totp";

export class TwoFactorError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TwoFactorError";
  }
}

export interface TotpEnrolment {
  secret: string;
  otpauthUrl: string;
}

/** Step 1: stage a new secret (disabled) and return the otpauth URI for a QR. */
export async function beginTotpEnrolment(userId: string): Promise<TotpEnrolment> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new TwoFactorError("User not found.");
  if (user.twoFactorEnabled) throw new TwoFactorError("Two-factor is already enabled.");

  const secret = generateTotpSecret();
  await prisma.user.update({ where: { id: userId }, data: { totpSecret: secret } });
  return { secret, otpauthUrl: totpKeyUri(user.email, secret) };
}

/** Step 2: verify a code against the staged secret, then enable 2FA. */
export async function confirmTotpEnrolment(userId: string, code: string): Promise<void> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new TwoFactorError("User not found.");
  if (!user.totpSecret) throw new TwoFactorError("Start two-factor setup first.");
  if (!verifyTotp(code.trim(), user.totpSecret)) {
    throw new TwoFactorError("That code is not valid. Try again.");
  }
  await prisma.user.update({ where: { id: userId }, data: { twoFactorEnabled: true } });
}

/** Disable 2FA, requiring a valid current code. */
export async function disableTwoFactor(userId: string, code: string): Promise<void> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new TwoFactorError("User not found.");
  if (!user.twoFactorEnabled || !user.totpSecret) return; // already off
  if (!verifyTotp(code.trim(), user.totpSecret)) {
    throw new TwoFactorError("That code is not valid.");
  }
  await prisma.user.update({
    where: { id: userId },
    data: { twoFactorEnabled: false, totpSecret: null },
  });
}
