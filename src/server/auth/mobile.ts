// Mobile-number verification via one-time SMS code.
// Only a hash of the 6-digit code is stored; the plain code is texted to the
// handset. Codes expire after 10 minutes and allow a handful of attempts.

import { randomInt } from "node:crypto";
import { prisma } from "@/server/db";
import { providers } from "@/server/providers";
import { hashToken } from "./tokens";

const CODE_TTL_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 5;

export class MobileVerificationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MobileVerificationError";
  }
}

function generateCode(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

/**
 * Save the user's (new) mobile number, mark it unverified, and text a code.
 * Replaces any outstanding code for the user.
 */
export async function sendMobileCode(userId: string, mobile: string): Promise<void> {
  const normalised = mobile.replace(/\s+/g, "");
  const code = generateCode();

  await prisma.$transaction([
    prisma.user.update({
      where: { id: userId },
      data: { mobile: normalised, mobileVerified: false },
    }),
    prisma.phoneVerificationToken.deleteMany({ where: { userId } }),
    prisma.phoneVerificationToken.create({
      data: {
        userId,
        mobile: normalised,
        hashedCode: hashToken(code),
        expiresAt: new Date(Date.now() + CODE_TTL_MS),
      },
    }),
  ]);

  await providers.sms.send({
    to: normalised,
    text: `Your PropManage verification code is ${code}. It expires in 10 minutes.`,
  });
}

/** Verify a texted code; on success marks the user's mobile as verified. */
export async function verifyMobileCode(userId: string, code: string): Promise<void> {
  const token = await prisma.phoneVerificationToken.findFirst({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });
  if (!token) throw new MobileVerificationError("Request a code first.");
  if (token.expiresAt < new Date()) {
    await prisma.phoneVerificationToken.delete({ where: { id: token.id } });
    throw new MobileVerificationError("That code has expired. Request a new one.");
  }
  if (token.attempts >= MAX_ATTEMPTS) {
    await prisma.phoneVerificationToken.delete({ where: { id: token.id } });
    throw new MobileVerificationError("Too many attempts. Request a new code.");
  }

  if (hashToken(code.trim()) !== token.hashedCode) {
    await prisma.phoneVerificationToken.update({
      where: { id: token.id },
      data: { attempts: { increment: 1 } },
    });
    throw new MobileVerificationError("That code is not correct.");
  }

  await prisma.$transaction([
    prisma.user.update({
      where: { id: userId },
      data: { mobile: token.mobile, mobileVerified: true },
    }),
    prisma.phoneVerificationToken.deleteMany({ where: { userId } }),
  ]);
}
