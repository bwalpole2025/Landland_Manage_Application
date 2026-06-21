// Resolves who/where a notification goes for an account: the inbox owner (for
// in-app + push targeting), the verified owner email addresses, and registered
// push device tokens.

import type { PrismaClient } from "@prisma/client";

export interface Recipients {
  /** Owner who receives the in-app inbox item; null if the account has no owner. */
  inboxUserId: string | null;
  emails: string[];
  pushTokens: string[];
}

export async function resolveRecipients(
  prisma: PrismaClient,
  accountId: string,
): Promise<Recipients> {
  const [owners, devices] = await Promise.all([
    prisma.user.findMany({
      where: { accountId, role: "OWNER" },
      select: { id: true, email: true, emailVerified: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.pushDevice.findMany({ where: { accountId }, select: { token: true } }),
  ]);

  return {
    inboxUserId: owners[0]?.id ?? null,
    emails: owners.filter((o) => o.emailVerified).map((o) => o.email),
    pushTokens: devices.map((d) => d.token),
  };
}
