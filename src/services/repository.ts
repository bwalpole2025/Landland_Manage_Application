// Read-side data access over the mock dataset.
//
// This is the seam where a real database (e.g. Postgres/Prisma) will land.
// Components depend on these functions, not on the raw mock arrays, so the
// storage backend can be swapped without touching the UI.

import {
  account,
  bankAccounts,
  companies,
  complianceDocuments,
  insurancePolicies,
  memberships,
  mortgages,
  mtdObligations,
  mtdSubmissions,
  portfolios,
  properties,
  propertyNotes,
  reminders,
  tenancies,
  transactions,
  users,
  valuations,
} from "@/data/mock-data";
import type {
  Account,
  BankAccount,
  Company,
  ComplianceDocument,
  InsurancePolicy,
  Membership,
  Mortgage,
  MtdObligation,
  MtdSubmission,
  Portfolio,
  Property,
  PropertyNote,
  Reminder,
  Tenancy,
  Transaction,
  User,
  Valuation,
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

/** Active (non-archived) properties — what every "active list" should show. */
export function getProperties(): Property[] {
  return properties.filter((p) => !p.archivedAt);
}

/** All properties including archived (used for history/admin views). */
export function getAllProperties(): Property[] {
  return properties;
}

/** A property by id — returns archived ones too, so history is preserved. */
export function getProperty(id: string): Property | undefined {
  return properties.find((p) => p.id === id);
}

/** Archive a property: hides it from active lists, keeps all its history. */
export function archiveProperty(id: string, when: string): void {
  const p = properties.find((x) => x.id === id);
  if (p) p.archivedAt = when;
}

/** Restore an archived property back into active lists. */
export function restoreProperty(id: string): void {
  const p = properties.find((x) => x.id === id);
  if (p) delete p.archivedAt;
}

export function getNotes(propertyId: string): PropertyNote[] {
  return propertyNotes
    .filter((n) => n.propertyId === propertyId)
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

export function getAllNotes(): PropertyNote[] {
  return propertyNotes;
}

// --- Reminders ---------------------------------------------------------------

export function getReminders(): Reminder[] {
  return reminders;
}

let reminderSeq = 0;

export function createReminder(input: Omit<Reminder, "id" | "accountId" | "status"> & { status?: Reminder["status"] }): Reminder {
  reminderSeq += 1;
  const reminder: Reminder = { id: `rem_new_${reminderSeq}`, accountId: "acc_1", status: input.status ?? "open", ...input };
  reminders.push(reminder);
  return reminder;
}

export function completeReminder(id: string, when: string): void {
  const r = reminders.find((x) => x.id === id);
  if (r) { r.status = "completed"; r.completedAt = when; }
}

export function reopenReminder(id: string): void {
  const r = reminders.find((x) => x.id === id);
  if (r) { r.status = "open"; r.completedAt = undefined; }
}

export function clearCompletedReminders(): void {
  for (let i = reminders.length - 1; i >= 0; i--) {
    if (reminders[i].status === "completed") reminders.splice(i, 1);
  }
}

export function removeReminder(id: string): void {
  const i = reminders.findIndex((r) => r.id === id);
  if (i >= 0) reminders.splice(i, 1);
}

export function setPropertyPortfolio(id: string, portfolioId: string): void {
  const p = properties.find((x) => x.id === id);
  if (p) p.portfolioId = portfolioId;
}

export function getValuations(): Valuation[] {
  return valuations;
}

/** The most recent valuation for a property, or undefined if none on record. */
export function getCurrentValuation(propertyId: string): Valuation | undefined {
  return valuations
    .filter((v) => v.propertyId === propertyId)
    .sort((a, b) => (a.date < b.date ? 1 : -1))[0];
}

export function getMortgages(): Mortgage[] {
  return mortgages;
}

export function getMortgageForProperty(propertyId: string): Mortgage | undefined {
  return mortgages.find((m) => m.propertyId === propertyId);
}

export function getPortfolios(): Portfolio[] {
  return portfolios;
}

export function getCompanies(): Company[] {
  return companies;
}

export function getCompany(id: string | undefined): Company | undefined {
  return id ? companies.find((c) => c.id === id) : undefined;
}

export function getPortfolio(id: string | undefined): Portfolio | undefined {
  if (!id) return portfolios.find((p) => p.isDefault);
  return portfolios.find((p) => p.id === id);
}

export function getInsurancePolicies(propertyId?: string): InsurancePolicy[] {
  return propertyId ? insurancePolicies.filter((i) => i.propertyId === propertyId) : insurancePolicies;
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

let tenancySeq = 0;

/** Create a tenancy. Its rentDueDay/rentPence/startDate drive the rent schedule. */
export function createTenancy(input: Omit<Tenancy, "id" | "status"> & { status?: Tenancy["status"] }): Tenancy {
  tenancySeq += 1;
  const tenancy: Tenancy = { id: `ten_new_${tenancySeq}`, status: input.status ?? "active", ...input };
  tenancies.push(tenancy);
  return tenancy;
}

export function removeTenancy(id: string): void {
  const i = tenancies.findIndex((t) => t.id === id);
  if (i >= 0) tenancies.splice(i, 1);
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

let documentSeq = 0;

export function createDocument(input: Omit<ComplianceDocument, "id" | "accountId">): ComplianceDocument {
  documentSeq += 1;
  const doc: ComplianceDocument = { id: `doc_new_${documentSeq}`, accountId: "acc_1", ...input };
  complianceDocuments.push(doc);
  return doc;
}

export function removeDocument(id: string): void {
  const i = complianceDocuments.findIndex((d) => d.id === id);
  if (i >= 0) complianceDocuments.splice(i, 1);
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
