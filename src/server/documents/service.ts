// Documents/evidence service. Uploads files through a StoragePort (injected, so
// tests use the in-memory adapter), persists evidence rows with `ownerId`
// stamped, and maps CONFIRMED rows to engine evidence.
//
// CLAIM SEPARATION: an upload records only a PROPOSED expiry. It becomes the
// structural fact the engine reads (`expiresOn`) only when the landlord confirms
// it — never silently.

import { randomUUID } from "node:crypto";
import type { EvidenceKind, PrismaClient } from "@prisma/client";
import { storageKey, type StorageBody, type StoragePort } from "@integrations";
import type { Evidence as EngineEvidence } from "@obligations-engine";

/** Evidence kind → the engine's evidenceType string. */
const KIND_TO_TYPE: Record<EvidenceKind, string> = {
  GAS_SAFETY: "gas_safety",
  EICR: "eicr",
  EPC: "epc",
  SMOKE_CO_ALARM: "smoke_co_alarm",
  INSURANCE: "insurance",
  DEPOSIT_PROTECTION: "deposit_protection",
  HMO_LICENCE: "hmo_licence",
  SELECTIVE_LICENCE: "selective_licence",
  OTHER: "other",
};

function isoDate(d: Date | null): string | null {
  return d ? d.toISOString().slice(0, 10) : null;
}

export interface UploadEvidenceInput {
  accountId: string;
  ownerId: string;
  propertyId: string;
  kind: EvidenceKind;
  filename: string;
  contentType: string;
  body: StorageBody;
  /** Proposed (non-authoritative) expiry — manual now, OCR later. */
  proposedExpiresOn?: string | null;
  issuedOn?: string | null;
}

export interface EvidenceView {
  id: string;
  kind: EvidenceKind;
  filename: string;
  storageKey: string;
  contentType: string | null;
  signedUrl: string;
  issuedOn: string | null;
  anniversary: string | null;
  proposedExpiresOn: string | null;
  expiresOn: string | null;
  /** Confirmed once the landlord confirms its structural dates (expiry, or gas dates). */
  confirmed: boolean;
  createdAt: string;
}

/** Upload a file and persist an evidence row (expiry only PROPOSED, not confirmed). */
export async function uploadEvidence(
  prisma: PrismaClient,
  storage: StoragePort,
  input: UploadEvidenceInput,
): Promise<{ id: string; storageKey: string }> {
  const id = `ev_${randomUUID()}`;
  const key = storageKey({ ownerId: input.ownerId, propertyId: input.propertyId, evidenceId: id, filename: input.filename });

  await storage.put(key, input.body, input.contentType);

  await prisma.evidence.create({
    data: {
      id,
      accountId: input.accountId,
      ownerId: input.ownerId,
      propertyId: input.propertyId,
      kind: input.kind,
      storageKey: key,
      filename: input.filename,
      contentType: input.contentType,
      issuedOn: input.issuedOn ? new Date(input.issuedOn) : null,
      proposedExpiresOn: input.proposedExpiresOn ? new Date(input.proposedExpiresOn) : null,
      // Confirmed fields stay null until the landlord confirms.
      expiresOn: null,
      confirmedAt: null,
    },
  });

  return { id, storageKey: key };
}

/** Confirm the expiry — promotes a proposal into the authoritative `expiresOn`. */
export async function confirmExpiry(
  prisma: PrismaClient,
  input: { accountId: string; evidenceId: string; expiresOn: string },
): Promise<void> {
  await prisma.evidence.updateMany({
    where: { id: input.evidenceId, accountId: input.accountId }, // account-scoped
    data: { expiresOn: new Date(input.expiresOn), confirmedAt: new Date() },
  });
}

/**
 * Confirm a gas inspection by capturing BOTH the original anniversary AND the
 * inspection date. No manual expiry is stored — the engine derives the next-due
 * date via anniversary preservation (nextGasDue). This is the structural fact
 * the engine reads once confirmed.
 */
export async function confirmGasInspection(
  prisma: PrismaClient,
  input: { accountId: string; evidenceId: string; inspectionDate: string; anniversary: string },
): Promise<void> {
  await prisma.evidence.updateMany({
    where: { id: input.evidenceId, accountId: input.accountId },
    data: {
      issuedOn: new Date(input.inspectionDate),
      anniversary: new Date(input.anniversary),
      expiresOn: null, // engine computes the due date from the two dates above
      confirmedAt: new Date(),
    },
  });
}

/** Remove an evidence row and its stored object. */
export async function removeEvidence(
  prisma: PrismaClient,
  storage: StoragePort,
  input: { accountId: string; evidenceId: string },
): Promise<void> {
  const row = await prisma.evidence.findFirst({ where: { id: input.evidenceId, accountId: input.accountId } });
  if (!row) return;
  await storage.remove(row.storageKey);
  await prisma.evidence.delete({ where: { id: row.id } });
}

/** List a property's evidence with fresh signed download URLs. */
export async function listEvidence(
  prisma: PrismaClient,
  storage: StoragePort,
  input: { accountId: string; propertyId: string },
): Promise<EvidenceView[]> {
  const rows = await prisma.evidence.findMany({
    where: { accountId: input.accountId, propertyId: input.propertyId },
    orderBy: { createdAt: "desc" },
  });
  return Promise.all(
    rows.map(async (r) => ({
      id: r.id,
      kind: r.kind,
      filename: r.filename,
      storageKey: r.storageKey,
      contentType: r.contentType,
      signedUrl: await storage.signedUrl(r.storageKey, 3600),
      issuedOn: isoDate(r.issuedOn),
      anniversary: isoDate(r.anniversary),
      proposedExpiresOn: isoDate(r.proposedExpiresOn),
      expiresOn: isoDate(r.expiresOn),
      confirmed: r.confirmedAt !== null,
      createdAt: r.createdAt.toISOString(),
    })),
  );
}

/**
 * The CONFIRMED evidence rows mapped to engine evidence. Only rows the landlord
 * has confirmed (`confirmedAt` set) are returned — proposals are deliberately
 * excluded, so an unconfirmed extracted date never reaches the engine.
 *
 * Gas rows carry the inspection date (`issuedOn`) + original `anniversary` and
 * NO expiry, so the engine computes the next-due via anniversary preservation.
 * Other kinds carry the confirmed `expiresOn`, which the engine reads directly.
 */
export async function confirmedEngineEvidence(
  prisma: PrismaClient,
  accountId: string,
  propertyId: string,
): Promise<EngineEvidence[]> {
  const rows = await prisma.evidence.findMany({
    where: { accountId, propertyId, confirmedAt: { not: null } },
  });
  return rows.map((r) => {
    const expiresOn = isoDate(r.expiresOn);
    const issuedOn = isoDate(r.issuedOn);
    const anniversary = isoDate(r.anniversary);
    const evidence: EngineEvidence = {
      id: r.id,
      type: KIND_TO_TYPE[r.kind],
      performedOn: issuedOn ?? expiresOn ?? isoDate(r.confirmedAt)!,
    };
    if (expiresOn) evidence.expiresOn = expiresOn;
    if (anniversary) evidence.anniversary = anniversary;
    return evidence;
  });
}
