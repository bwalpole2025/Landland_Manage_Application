// Opaque single-use tokens for email verification and password reset.
// Only a SHA-256 hash of each token is stored; the raw token travels by email.

import { createHash, randomBytes } from "node:crypto";
import { prisma } from "@/server/db";

const HOUR = 60 * 60 * 1000;

export function hashToken(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

function newToken(): { raw: string; hash: string } {
  const raw = randomBytes(32).toString("base64url");
  return { raw, hash: hashToken(raw) };
}

export async function createEmailVerificationToken(userId: string): Promise<string> {
  const { raw, hash } = newToken();
  await prisma.emailVerificationToken.create({
    data: { userId, hashedToken: hash, expiresAt: new Date(Date.now() + 24 * HOUR) },
  });
  return raw;
}

export async function consumeEmailVerificationToken(raw: string): Promise<string | null> {
  const row = await prisma.emailVerificationToken.findUnique({ where: { hashedToken: hashToken(raw) } });
  if (!row || row.expiresAt < new Date()) return null;
  await prisma.emailVerificationToken.delete({ where: { id: row.id } });
  return row.userId;
}

export async function createPasswordResetToken(userId: string): Promise<string> {
  const { raw, hash } = newToken();
  await prisma.passwordResetToken.create({
    data: { userId, hashedToken: hash, expiresAt: new Date(Date.now() + HOUR) },
  });
  return raw;
}

export async function consumePasswordResetToken(raw: string): Promise<string | null> {
  const row = await prisma.passwordResetToken.findUnique({ where: { hashedToken: hashToken(raw) } });
  if (!row || row.usedAt || row.expiresAt < new Date()) return null;
  await prisma.passwordResetToken.update({ where: { id: row.id }, data: { usedAt: new Date() } });
  return row.userId;
}
