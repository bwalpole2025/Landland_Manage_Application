// Read/write helpers for the in-app notification inbox (channel = IN_APP) and
// push-device registration. Used by the notifications tRPC router.

import type { PrismaClient } from "@prisma/client";

export interface InboxItem {
  id: string;
  category: string;
  title: string;
  body: string;
  href: string | null;
  read: boolean;
  createdAt: string;
}

export async function listInbox(
  prisma: PrismaClient,
  accountId: string,
  limit = 50,
): Promise<InboxItem[]> {
  const rows = await prisma.notification.findMany({
    where: { accountId, channel: "IN_APP" },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
  return rows.map((n) => ({
    id: n.id,
    category: n.category,
    title: n.title,
    body: n.body,
    href: n.href,
    read: n.readAt !== null,
    createdAt: n.createdAt.toISOString(),
  }));
}

export function unreadCount(prisma: PrismaClient, accountId: string): Promise<number> {
  return prisma.notification.count({ where: { accountId, channel: "IN_APP", readAt: null } });
}

export async function markRead(
  prisma: PrismaClient,
  accountId: string,
  id: string,
): Promise<void> {
  // Scope the update to the account so one tenant can't read another's rows.
  await prisma.notification.updateMany({
    where: { id, accountId, channel: "IN_APP", readAt: null },
    data: { readAt: new Date() },
  });
}

export async function markAllRead(prisma: PrismaClient, accountId: string): Promise<void> {
  await prisma.notification.updateMany({
    where: { accountId, channel: "IN_APP", readAt: null },
    data: { readAt: new Date() },
  });
}

export async function registerPushDevice(
  prisma: PrismaClient,
  accountId: string,
  userId: string,
  token: string,
  platform: string,
): Promise<void> {
  await prisma.pushDevice.upsert({
    where: { token },
    create: { accountId, userId, token, platform },
    update: { accountId, userId, platform, lastSeenAt: new Date() },
  });
}
