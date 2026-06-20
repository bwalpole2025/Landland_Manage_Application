// DB-backed session-cookie auth. The cookie holds an opaque random token; only
// its SHA-256 hash is stored. getSession() is what server components and the
// tRPC context call to identify the request.

import { cookies } from "next/headers";
import type { AccountType, Role } from "@prisma/client";
import { prisma } from "@/server/db";
import { env } from "@/server/env";
import { hashToken } from "./tokens";
import { randomBytes } from "node:crypto";

const SESSION_TTL_DAYS = 30;

export type UiRole = "owner" | "assistant" | "accountant";
export type UiAccountType = "individual" | "portfolio" | "limited_company";

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  /** True once the email address has been confirmed. */
  emailVerified: boolean;
}

export type SubscriptionStatus = "TRIALING" | "ACTIVE" | "PAST_DUE" | "CANCELED";

export interface SessionAccount {
  id: string;
  name: string;
  type: UiAccountType;
  mtd: { enrolled: boolean; utr?: string };
  subscription: { status: SubscriptionStatus; trialEndsAt: string | null };
}

export interface AppSession {
  user: SessionUser;
  account: SessionAccount;
  role: UiRole;
  isDelegated: boolean;
}

const ROLE_MAP: Record<Role, UiRole> = { OWNER: "owner", ASSISTANT: "assistant", ACCOUNTANT: "accountant" };
const ACCOUNT_TYPE_MAP: Record<AccountType, UiAccountType> = {
  INDIVIDUAL: "individual",
  PORTFOLIO: "portfolio",
  LIMITED_COMPANY: "limited_company",
};

/** Create a session row and return the raw token to place in the cookie. */
export async function createSessionToken(userId: string, activeAccountId: string): Promise<string> {
  const raw = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000);
  await prisma.session.create({
    data: { userId, activeAccountId, hashedToken: hashToken(raw), expiresAt },
  });
  return raw;
}

export function setSessionCookie(rawToken: string): void {
  cookies().set(env.sessionCookieName, rawToken, {
    httpOnly: true,
    sameSite: "lax",
    secure: env.isProduction,
    path: "/",
    maxAge: SESSION_TTL_DAYS * 24 * 60 * 60,
  });
}

export async function clearSession(): Promise<void> {
  const raw = cookies().get(env.sessionCookieName)?.value;
  if (raw) await prisma.session.deleteMany({ where: { hashedToken: hashToken(raw) } });
  cookies().delete(env.sessionCookieName);
}

export async function validateSessionToken(rawToken: string): Promise<AppSession | null> {
  const session = await prisma.session.findUnique({
    where: { hashedToken: hashToken(rawToken) },
    include: { user: { include: { memberships: true } } },
  });
  if (!session) return null;
  if (session.expiresAt < new Date()) {
    await prisma.session.delete({ where: { id: session.id } }).catch(() => {});
    return null;
  }

  const account = await prisma.account.findUnique({ where: { id: session.activeAccountId } });
  const membership = session.user.memberships.find((m) => m.accountId === session.activeAccountId);
  if (!account || !membership) return null;

  return {
    user: {
      id: session.user.id,
      name: `${session.user.firstName} ${session.user.lastName}`.trim(),
      email: session.user.email,
      emailVerified: session.user.emailVerified !== null,
    },
    account: {
      id: account.id,
      name: account.name,
      type: ACCOUNT_TYPE_MAP[account.type],
      mtd: { enrolled: account.mtdEnrolled, utr: account.utr ?? undefined },
      subscription: {
        status: account.subscriptionStatus as SubscriptionStatus,
        trialEndsAt: account.trialEndsAt ? account.trialEndsAt.toISOString() : null,
      },
    },
    role: ROLE_MAP[membership.role],
    isDelegated: membership.delegated,
  };
}

/** Read the current session from the request cookie (null if unauthenticated). */
export async function getSession(): Promise<AppSession | null> {
  const raw = cookies().get(env.sessionCookieName)?.value;
  if (!raw) return null;
  return validateSessionToken(raw);
}

/** Coarse capability check used to gate write actions in the UI/API. */
export function can(role: UiRole, action: "edit" | "submit_mtd" | "manage_users"): boolean {
  switch (action) {
    case "edit":
      return true;
    case "submit_mtd":
      return role === "owner" || role === "accountant";
    case "manage_users":
      return role === "owner";
  }
}
