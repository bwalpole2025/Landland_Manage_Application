// Licensing records (HMO / additional / selective) with grant + expiry dates,
// mapped to engine evidence so the licence-expiry obligations read their expiry.

import type { LicenceType, PrismaClient } from "@prisma/client";
import type { Evidence as EngineEvidence } from "@obligations-engine";

const TYPE_TO_EVIDENCE: Record<LicenceType, string> = {
  HMO: "hmo_licence",
  ADDITIONAL: "additional_licence",
  SELECTIVE: "selective_licence",
};

function isoDate(d: Date | null): string | null {
  return d ? d.toISOString().slice(0, 10) : null;
}
function toDate(iso: string | null | undefined): Date | null {
  return iso ? new Date(iso) : null;
}

export interface LicenceView {
  id: string;
  type: LicenceType;
  reference: string | null;
  grantedOn: string | null;
  expiresOn: string | null;
}

export async function listLicences(prisma: PrismaClient, accountId: string, propertyId: string): Promise<LicenceView[]> {
  const rows = await prisma.licenceRecord.findMany({ where: { accountId, propertyId }, orderBy: { createdAt: "desc" } });
  return rows.map((r) => ({ id: r.id, type: r.type, reference: r.reference, grantedOn: isoDate(r.grantedOn), expiresOn: isoDate(r.expiresOn) }));
}

export async function addLicence(
  prisma: PrismaClient,
  accountId: string,
  propertyId: string,
  input: { type: LicenceType; reference: string | null; grantedOn: string | null; expiresOn: string | null },
): Promise<string> {
  const row = await prisma.licenceRecord.create({
    data: { accountId, propertyId, type: input.type, reference: input.reference, grantedOn: toDate(input.grantedOn), expiresOn: toDate(input.expiresOn) },
  });
  return row.id;
}

export async function removeLicence(prisma: PrismaClient, accountId: string, licenceId: string): Promise<void> {
  await prisma.licenceRecord.deleteMany({ where: { id: licenceId, accountId } });
}

/** Map licence records to engine evidence (so the licence-expiry rules read them). */
export async function loadLicenceEvidence(prisma: PrismaClient, accountId: string, propertyId: string): Promise<EngineEvidence[]> {
  const rows = await prisma.licenceRecord.findMany({ where: { accountId, propertyId } });
  return rows
    .filter((r) => r.grantedOn || r.expiresOn)
    .map((r) => {
      const expiresOn = isoDate(r.expiresOn);
      const performedOn = isoDate(r.grantedOn) ?? expiresOn ?? isoDate(r.createdAt)!;
      const evidence: EngineEvidence = { id: r.id, type: TYPE_TO_EVIDENCE[r.type], performedOn };
      if (expiresOn) evidence.expiresOn = expiresOn;
      return evidence;
    });
}
