// Team invitations: an account owner invites an assistant or accountant, who
// accepts via an emailed link and gains *delegated* access (a Membership with
// `delegated = true`) to the inviting account. New invitees set their own
// password on accept — we never create credentials on their behalf.

import { randomBytes } from "node:crypto";
import type { Role } from "@prisma/client";
import { prisma } from "@/server/db";
import { providers } from "@/server/providers";
import { env } from "@/server/env";
import { hashPassword } from "./password";
import { hashToken } from "./tokens";

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export type InvitableRole = "ASSISTANT" | "ACCOUNTANT";

export class InvitationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvitationError";
  }
}

export interface AcceptInvitationInput {
  token: string;
  // Required only when the invitee is a brand-new user setting up their account.
  firstName?: string;
  lastName?: string;
  password?: string;
}

/** Owner invites a user to the account; emails an accept link. */
export async function createInvitation(
  accountId: string,
  invitedById: string,
  rawEmail: string,
  role: InvitableRole,
): Promise<void> {
  const email = rawEmail.toLowerCase().trim();

  // Already a member of this account?
  const existingMember = await prisma.membership.findFirst({
    where: { accountId, user: { email } },
  });
  if (existingMember) throw new InvitationError("That person is already on this account.");

  const raw = randomBytes(32).toString("base64url");

  // Supersede any outstanding pending invite for the same email + account.
  await prisma.invitation.updateMany({
    where: { accountId, email, status: "PENDING" },
    data: { status: "REVOKED" },
  });

  await prisma.invitation.create({
    data: {
      accountId,
      invitedById,
      email,
      role,
      hashedToken: hashToken(raw),
      expiresAt: new Date(Date.now() + INVITE_TTL_MS),
    },
  });

  const account = await prisma.account.findUnique({ where: { id: accountId } });
  await providers.mailer.send({
    to: email,
    subject: `You've been invited to ${account?.name ?? "a PropManage account"}`,
    text: `You've been invited as ${role === "ACCOUNTANT" ? "an accountant" : "an assistant"}. Accept your invitation: ${env.appUrl}/invite?token=${raw}`,
  });
}

export interface TeamMember {
  membershipId: string;
  userId: string;
  name: string;
  email: string;
  role: Role;
  delegated: boolean;
}

export interface PendingInvite {
  id: string;
  email: string;
  role: Role;
  invitedAt: string;
}

/** Current members + outstanding invitations for an account. */
export async function listTeam(accountId: string): Promise<{ members: TeamMember[]; pending: PendingInvite[] }> {
  const [memberships, invites] = await Promise.all([
    prisma.membership.findMany({
      where: { accountId },
      include: { user: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.invitation.findMany({
      where: { accountId, status: "PENDING" },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  return {
    members: memberships.map((m) => ({
      membershipId: m.id,
      userId: m.userId,
      name: `${m.user.firstName} ${m.user.lastName}`.trim(),
      email: m.user.email,
      role: m.role,
      delegated: m.delegated,
    })),
    pending: invites.map((i) => ({
      id: i.id,
      email: i.email,
      role: i.role,
      invitedAt: i.createdAt.toISOString(),
    })),
  };
}

export async function revokeInvitation(accountId: string, invitationId: string): Promise<void> {
  await prisma.invitation.updateMany({
    where: { id: invitationId, accountId, status: "PENDING" },
    data: { status: "REVOKED" },
  });
}

export interface InvitationPreview {
  email: string;
  role: Role;
  accountName: string;
  userExists: boolean;
}

/** Look up a pending invitation by raw token (for rendering the accept page). */
export async function previewInvitation(rawToken: string): Promise<InvitationPreview | null> {
  const invite = await prisma.invitation.findUnique({
    where: { hashedToken: hashToken(rawToken) },
    include: { account: true },
  });
  if (!invite || invite.status !== "PENDING" || invite.expiresAt < new Date()) return null;
  const user = await prisma.user.findUnique({ where: { email: invite.email } });
  return {
    email: invite.email,
    role: invite.role,
    accountName: invite.account.name,
    userExists: Boolean(user),
  };
}

/**
 * Accept an invitation. Creates a delegated Membership into the inviting
 * account. If the invitee is new, also creates their own home account and they
 * set their own password here. Returns the account to activate on first login.
 */
export async function acceptInvitation(input: AcceptInvitationInput): Promise<{ userId: string; activeAccountId: string }> {
  const invite = await prisma.invitation.findUnique({ where: { hashedToken: hashToken(input.token) } });
  if (!invite || invite.status !== "PENDING" || invite.expiresAt < new Date()) {
    throw new InvitationError("This invitation is invalid or has expired.");
  }

  const existing = await prisma.user.findUnique({ where: { email: invite.email } });

  const result = await prisma.$transaction(async (tx) => {
    let userId: string;

    if (existing) {
      userId = existing.id;
    } else {
      // New invitee: they set their own name + password (never auto-created).
      const firstName = input.firstName?.trim();
      const lastName = input.lastName?.trim();
      if (!firstName || !lastName || !input.password || input.password.length < 8) {
        throw new InvitationError("Enter your name and a password of at least 8 characters.");
      }
      const passwordHash = await hashPassword(input.password);
      const home = await tx.account.create({
        data: { name: `${firstName} ${lastName}'s account`.trim(), type: "INDIVIDUAL" },
      });
      const created = await tx.user.create({
        data: {
          email: invite.email,
          firstName,
          lastName,
          passwordHash,
          accountId: home.id,
          role: invite.role,
          emailVerified: new Date(), // proven by clicking the emailed link
        },
      });
      await tx.membership.create({ data: { userId: created.id, accountId: home.id, role: "OWNER" } });
      await tx.portfolio.create({
        data: { accountId: home.id, name: "Personal — Default", type: "PERSONAL", isDefault: true },
      });
      userId = created.id;
    }

    // Delegated membership into the inviting account (idempotent).
    await tx.membership.upsert({
      where: { userId_accountId: { userId, accountId: invite.accountId } },
      update: { role: invite.role, delegated: true },
      create: { userId, accountId: invite.accountId, role: invite.role, delegated: true },
    });

    await tx.invitation.update({
      where: { id: invite.id },
      data: { status: "ACCEPTED", acceptedAt: new Date() },
    });

    return { userId, activeAccountId: invite.accountId };
  });

  return result;
}
