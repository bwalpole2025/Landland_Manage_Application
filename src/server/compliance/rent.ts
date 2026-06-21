// Rent service: the expected schedule + the received-payment ledger, and the
// engine-derived arrears assessment. Bank-feed reconciliation (Section 4) will
// later write CONFIRMED receipts into the same `RentReceipt` ledger.
//
// CLAIM SEPARATION: arrears come from confirmed, dated receipts only — the
// engine (assessArrears) filters to confirmed and is the sole origin of the
// figure, status and Ground-8 threshold determinations.

import type { PrismaClient } from "@prisma/client";
import { assessArrears, type ArrearsAssessment, type RentFrequency, type RentReceipt as EngineReceipt } from "@obligations-engine";

function isoDate(d: Date | null): string | null {
  return d ? d.toISOString().slice(0, 10) : null;
}
function toDate(iso: string | null | undefined): Date | null {
  return iso ? new Date(iso) : null;
}
function engineFrequency(stored: string): RentFrequency {
  return stored === "WEEKLY" ? "weekly" : "monthly";
}

export interface ScheduleView {
  frequency: "MONTHLY" | "WEEKLY";
  rentGBP: number;
  startDate: string | null;
  endDate: string | null;
}

export interface ReceiptView {
  id: string;
  date: string | null;
  amountGBP: number;
  source: string;
  confirmed: boolean;
  reference: string | null;
}

export async function getSchedule(prisma: PrismaClient, accountId: string, propertyId: string): Promise<ScheduleView | null> {
  const row = await prisma.rentSchedule.findUnique({ where: { accountId_propertyId: { accountId, propertyId } } });
  if (!row) return null;
  return {
    frequency: row.frequency === "WEEKLY" ? "WEEKLY" : "MONTHLY",
    rentGBP: row.rentGBP,
    startDate: isoDate(row.startDate),
    endDate: isoDate(row.endDate),
  };
}

export async function saveSchedule(
  prisma: PrismaClient,
  accountId: string,
  propertyId: string,
  input: { frequency: string; rentGBP: number; startDate: string; endDate: string | null },
): Promise<void> {
  const data = {
    frequency: input.frequency === "WEEKLY" ? "WEEKLY" : "MONTHLY",
    rentGBP: input.rentGBP,
    startDate: new Date(input.startDate),
    endDate: toDate(input.endDate),
  };
  await prisma.rentSchedule.upsert({
    where: { accountId_propertyId: { accountId, propertyId } },
    create: { accountId, propertyId, ...data },
    update: data,
  });
}

export async function listReceipts(prisma: PrismaClient, accountId: string, propertyId: string): Promise<ReceiptView[]> {
  const rows = await prisma.rentReceipt.findMany({ where: { accountId, propertyId }, orderBy: { date: "desc" } });
  return rows.map((r) => ({
    id: r.id,
    date: isoDate(r.date),
    amountGBP: r.amountGBP,
    source: r.source,
    confirmed: r.confirmed,
    reference: r.reference,
  }));
}

/** Record a manual rent receipt (confirmed — the landlord asserts it). */
export async function addManualReceipt(
  prisma: PrismaClient,
  accountId: string,
  propertyId: string,
  input: { date: string; amountGBP: number; reference: string | null },
): Promise<void> {
  await prisma.rentReceipt.create({
    data: { accountId, propertyId, date: new Date(input.date), amountGBP: input.amountGBP, source: "MANUAL", confirmed: true, reference: input.reference },
  });
}

export async function removeReceipt(prisma: PrismaClient, accountId: string, receiptId: string): Promise<void> {
  await prisma.rentReceipt.deleteMany({ where: { id: receiptId, accountId } });
}

export interface RentView {
  schedule: ScheduleView | null;
  receipts: ReceiptView[];
  assessment: ArrearsAssessment | null;
}

/** Load the ledger and run the engine's arrears assessment. */
export async function assessRentForProperty(
  prisma: PrismaClient,
  accountId: string,
  propertyId: string,
  stages: { asOf: string; noticeDate?: string; hearingDate?: string },
): Promise<RentView> {
  const [schedule, receipts] = await Promise.all([
    getSchedule(prisma, accountId, propertyId),
    listReceipts(prisma, accountId, propertyId),
  ]);

  let assessment: ArrearsAssessment | null = null;
  if (schedule && schedule.startDate) {
    const engineReceipts: EngineReceipt[] = receipts
      .filter((r): r is ReceiptView & { date: string } => r.date !== null)
      .map((r) => ({ date: r.date, amount: r.amountGBP, confirmed: r.confirmed }));
    assessment = assessArrears({
      frequency: engineFrequency(schedule.frequency),
      rentAmount: schedule.rentGBP,
      startDate: schedule.startDate,
      receipts: engineReceipts,
      asOf: stages.asOf,
      noticeDate: stages.noticeDate,
      hearingDate: stages.hearingDate,
    });
  }

  return { schedule, receipts, assessment };
}
