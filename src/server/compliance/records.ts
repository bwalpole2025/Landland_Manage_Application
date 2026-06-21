// Deposit & tenancy compliance records: load them as engine facts, and read/
// write them for the Deposit and Tenancy sub-sections. These records are the
// structural facts the engine reads — components never compute deadlines.

import type { PrismaClient } from "@prisma/client";
import type { DepositFacts, TenancyFacts } from "@obligations-engine";

function isoDate(d: Date | null): string | null {
  return d ? d.toISOString().slice(0, 10) : null;
}
function toDate(iso: string | null | undefined): Date | null {
  return iso ? new Date(iso) : null;
}

// --- Engine fact loaders (used by evaluateProperty) -------------------------

export async function loadDepositFacts(
  prisma: PrismaClient,
  accountId: string,
  propertyId: string,
): Promise<DepositFacts | undefined> {
  const row = await prisma.depositRecord.findUnique({ where: { accountId_propertyId: { accountId, propertyId } } });
  if (!row) return undefined;
  return {
    scheme: row.scheme,
    receivedOn: isoDate(row.receivedOn),
    protectedOn: isoDate(row.protectedOn),
    prescribedInfoServedOn: isoDate(row.prescribedInfoServedOn),
  };
}

export async function loadCurrentTenancyFacts(
  prisma: PrismaClient,
  accountId: string,
  propertyId: string,
): Promise<TenancyFacts | undefined> {
  const row = await prisma.tenancyRecord.findFirst({
    where: { accountId, propertyId, isCurrent: true },
    orderBy: { startDate: "desc" },
  });
  if (!row) return undefined;
  return {
    kind: row.kind,
    startDate: isoDate(row.startDate),
    writtenTermsProvidedOn: isoDate(row.writtenTermsProvidedOn),
    informationProvidedOn: isoDate(row.informationProvidedOn),
  };
}

// --- Deposit read/write -----------------------------------------------------

export interface DepositView {
  scheme: string | null;
  depositGBP: number | null;
  receivedOn: string | null;
  protectedOn: string | null;
  prescribedInfoServedOn: string | null;
}

export async function getDeposit(prisma: PrismaClient, accountId: string, propertyId: string): Promise<DepositView | null> {
  const row = await prisma.depositRecord.findUnique({ where: { accountId_propertyId: { accountId, propertyId } } });
  if (!row) return null;
  return {
    scheme: row.scheme,
    depositGBP: row.depositGBP,
    receivedOn: isoDate(row.receivedOn),
    protectedOn: isoDate(row.protectedOn),
    prescribedInfoServedOn: isoDate(row.prescribedInfoServedOn),
  };
}

export interface SaveDepositInput {
  scheme: string | null;
  depositGBP: number | null;
  receivedOn: string | null;
  protectedOn: string | null;
  prescribedInfoServedOn: string | null;
}

export async function saveDeposit(
  prisma: PrismaClient,
  accountId: string,
  propertyId: string,
  input: SaveDepositInput,
): Promise<void> {
  const data = {
    scheme: input.scheme,
    depositGBP: input.depositGBP,
    receivedOn: toDate(input.receivedOn),
    protectedOn: toDate(input.protectedOn),
    prescribedInfoServedOn: toDate(input.prescribedInfoServedOn),
  };
  await prisma.depositRecord.upsert({
    where: { accountId_propertyId: { accountId, propertyId } },
    create: { accountId, propertyId, ...data },
    update: data,
  });
}

// --- Tenancy read/write -----------------------------------------------------

export interface TenancyView {
  id: string;
  kind: string;
  startDate: string | null;
  endDate: string | null;
  isCurrent: boolean;
  writtenTermsProvidedOn: string | null;
  informationProvidedOn: string | null;
}

export async function listTenancies(prisma: PrismaClient, accountId: string, propertyId: string): Promise<TenancyView[]> {
  const rows = await prisma.tenancyRecord.findMany({
    where: { accountId, propertyId },
    orderBy: [{ isCurrent: "desc" }, { startDate: "desc" }],
  });
  return rows.map((r) => ({
    id: r.id,
    kind: r.kind,
    startDate: isoDate(r.startDate),
    endDate: isoDate(r.endDate),
    isCurrent: r.isCurrent,
    writtenTermsProvidedOn: isoDate(r.writtenTermsProvidedOn),
    informationProvidedOn: isoDate(r.informationProvidedOn),
  }));
}

export interface SaveTenancyInput {
  kind: string;
  startDate: string | null;
  writtenTermsProvidedOn: string | null;
  informationProvidedOn: string | null;
}

/** Edit the current tenancy record (creating it if none exists). */
export async function saveCurrentTenancy(
  prisma: PrismaClient,
  accountId: string,
  propertyId: string,
  input: SaveTenancyInput,
): Promise<void> {
  const data = {
    kind: input.kind,
    startDate: toDate(input.startDate),
    writtenTermsProvidedOn: toDate(input.writtenTermsProvidedOn),
    informationProvidedOn: toDate(input.informationProvidedOn),
  };
  const current = await prisma.tenancyRecord.findFirst({ where: { accountId, propertyId, isCurrent: true } });
  if (current) {
    await prisma.tenancyRecord.update({ where: { id: current.id }, data });
  } else {
    await prisma.tenancyRecord.create({ data: { accountId, propertyId, isCurrent: true, ...data } });
  }
}

/** Archive the current tenancy (into history) and start a new current one. */
export async function startNewTenancy(
  prisma: PrismaClient,
  accountId: string,
  propertyId: string,
  input: SaveTenancyInput,
): Promise<void> {
  await prisma.tenancyRecord.updateMany({
    where: { accountId, propertyId, isCurrent: true },
    data: { isCurrent: false },
  });
  await prisma.tenancyRecord.create({
    data: {
      accountId,
      propertyId,
      isCurrent: true,
      kind: input.kind,
      startDate: toDate(input.startDate),
      writtenTermsProvidedOn: toDate(input.writtenTermsProvidedOn),
      informationProvidedOn: toDate(input.informationProvidedOn),
    },
  });
}
