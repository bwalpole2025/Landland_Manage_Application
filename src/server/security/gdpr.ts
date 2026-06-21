// GDPR data-subject paths: a full machine-readable export of an account's data
// (right of access / portability) and irreversible account deletion (right to
// erasure). Both are owner-gated at the router layer and audited.

import type { PrismaClient } from "@prisma/client";
import { recordAudit } from "./audit";

/** Gather everything held for an account into a portable JSON object. */
export async function exportAccountData(
  prisma: PrismaClient,
  accountId: string,
): Promise<Record<string, unknown>> {
  const [account, users, properties, tenancies, transactions, documents, notes, reminders, bankAccounts, obligations, submissions, notifications, auditLogs] =
    await Promise.all([
      prisma.account.findUnique({ where: { id: accountId } }),
      prisma.user.findMany({ where: { accountId } }),
      prisma.property.findMany({ where: { accountId } }),
      prisma.tenancy.findMany({ where: { accountId }, include: { tenants: true } }),
      prisma.transaction.findMany({ where: { accountId } }),
      prisma.document.findMany({ where: { accountId } }),
      prisma.note.findMany({ where: { accountId } }),
      prisma.reminder.findMany({ where: { accountId } }),
      prisma.bankAccount.findMany({ where: { accountId } }),
      prisma.mtdObligation.findMany({ where: { accountId } }),
      prisma.mtdSubmission.findMany({ where: { accountId } }),
      prisma.notification.findMany({ where: { accountId } }),
      prisma.auditLog.findMany({ where: { accountId } }),
    ]);

  // Redact secrets — never include password hashes or 2FA secrets in an export.
  const safeUsers = users.map(({ passwordHash, totpSecret, ...u }) => {
    void passwordHash;
    void totpSecret;
    return { ...u, twoFactorEnabled: u.twoFactorEnabled };
  });

  await recordAudit(
    {
      accountId,
      action: "EXPORT",
      entity: "account",
      entityId: accountId,
      summary: "Exported full account data (GDPR data access)",
    },
    prisma,
  );

  return {
    exportedAt: new Date().toISOString(),
    account,
    users: safeUsers,
    properties,
    tenancies,
    transactions,
    documents,
    notes,
    reminders,
    bankAccounts,
    mtdObligations: obligations,
    mtdSubmissions: submissions,
    notifications,
    auditLogs,
  };
}

/**
 * Irreversibly delete an account and all data scoped to it. Cascades remove
 * users, properties, transactions, etc. (see schema onDelete: Cascade).
 */
export async function deleteAccount(
  prisma: PrismaClient,
  accountId: string,
  actorUserId: string | null,
): Promise<void> {
  // Audit before the cascade removes the row.
  await recordAudit(
    { accountId, actorUserId, action: "DELETE", entity: "account", entityId: accountId, summary: "Account and all data permanently deleted (GDPR erasure)" },
    prisma,
  );
  await prisma.account.delete({ where: { id: accountId } });
}
