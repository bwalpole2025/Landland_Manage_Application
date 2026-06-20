// Read-side data access over the mock dataset.
//
// This is the seam where a real database (e.g. Postgres/Prisma) will land.
// Components depend on these functions, not on the raw mock arrays, so the
// storage backend can be swapped without touching the UI.

import {
  account,
  bankAccounts,
  complianceDocuments,
  memberships,
  mtdObligations,
  mtdSubmissions,
  properties,
  tenancies,
  transactions,
  users,
} from "@/data/mock-data";
import type {
  Account,
  BankAccount,
  ComplianceDocument,
  Membership,
  MtdObligation,
  MtdSubmission,
  Property,
  Tenancy,
  Transaction,
  User,
} from "@/lib/types";

export function getAccount(): Account {
  return account;
}

export function getUser(userId: string): User | undefined {
  return users.find((u) => u.id === userId);
}

export function getMemberships(): Membership[] {
  return memberships;
}

export function getMembershipFor(userId: string): Membership | undefined {
  return memberships.find((m) => m.userId === userId);
}

export function getProperties(): Property[] {
  return properties;
}

export function getProperty(id: string): Property | undefined {
  return properties.find((p) => p.id === id);
}

export function getTenancies(): Tenancy[] {
  return tenancies;
}

export function getTenanciesForProperty(propertyId: string): Tenancy[] {
  return tenancies.filter((t) => t.propertyId === propertyId);
}

export function getActiveTenancyForProperty(propertyId: string): Tenancy | undefined {
  return tenancies.find((t) => t.propertyId === propertyId && t.status === "active");
}

export function getTransactions(filter?: {
  propertyId?: string;
  reconcile?: Transaction["reconcile"];
}): Transaction[] {
  let rows = [...transactions];
  if (filter?.propertyId) rows = rows.filter((t) => t.propertyId === filter.propertyId);
  if (filter?.reconcile) rows = rows.filter((t) => t.reconcile === filter.reconcile);
  return rows.sort((a, b) => (a.date < b.date ? 1 : -1)); // newest first
}

export function getComplianceDocuments(propertyId?: string): ComplianceDocument[] {
  const rows = propertyId
    ? complianceDocuments.filter((d) => d.propertyId === propertyId)
    : complianceDocuments;
  return [...rows];
}

export function getBankAccounts(): BankAccount[] {
  return bankAccounts;
}

export function getMtdObligations(taxYear?: string): MtdObligation[] {
  const rows = taxYear ? mtdObligations.filter((o) => o.taxYear === taxYear) : mtdObligations;
  return [...rows].sort((a, b) => (a.startDate < b.startDate ? -1 : 1));
}

export function getMtdSubmissions(): MtdSubmission[] {
  return mtdSubmissions;
}

export function getSubmissionForObligation(obligationId: string): MtdSubmission | undefined {
  return mtdSubmissions.find((s) => s.obligationId === obligationId);
}
