"use server";

import { revalidatePath } from "next/cache";
import { getSession } from "@/server/auth/session";
import { prisma } from "@/server/db";
import { getStoragePort } from "@/server/storage";
import { confirmExpiry, confirmGasInspection, removeEvidence, uploadEvidence } from "@/server/documents/service";
import type { EvidenceKind } from "@prisma/client";

const KINDS: EvidenceKind[] = ["GAS_SAFETY", "EICR", "EPC", "SMOKE_CO_ALARM"];

export type ActionResult = { ok: true } | { ok: false; error: string };

function revalidate(propertyId: string) {
  revalidatePath(`/properties/${propertyId}/safety`);
  revalidatePath(`/properties/${propertyId}/essentials`); // statuses may change
}

export async function uploadCertificateAction(formData: FormData): Promise<ActionResult> {
  const session = await getSession();
  if (!session) return { ok: false, error: "Not signed in." };

  const propertyId = String(formData.get("propertyId") ?? "");
  const kind = String(formData.get("kind") ?? "") as EvidenceKind;
  const file = formData.get("file");

  if (!propertyId) return { ok: false, error: "Missing property." };
  if (!KINDS.includes(kind)) return { ok: false, error: "Invalid certificate type." };
  if (!(file instanceof File) || file.size === 0) return { ok: false, error: "Choose a file to upload." };

  const bytes = new Uint8Array(await file.arrayBuffer());
  await uploadEvidence(prisma, getStoragePort(), {
    accountId: session.account.id,
    ownerId: session.account.id, // tenant boundary = storage-RLS owner (leading key segment)
    propertyId,
    kind,
    filename: file.name || "certificate",
    contentType: file.type || "application/octet-stream",
    body: bytes,
  });

  revalidate(propertyId);
  return { ok: true };
}

/** Non-gas: confirm the certificate's expiry date. */
export async function confirmExpiryAction(input: {
  propertyId: string;
  evidenceId: string;
  expiresOn: string;
}): Promise<ActionResult> {
  const session = await getSession();
  if (!session) return { ok: false, error: "Not signed in." };
  if (!input.expiresOn) return { ok: false, error: "Enter the expiry date to confirm." };

  await confirmExpiry(prisma, { accountId: session.account.id, evidenceId: input.evidenceId, expiresOn: input.expiresOn });
  revalidate(input.propertyId);
  return { ok: true };
}

/** Gas: confirm BOTH the inspection date and the original anniversary. */
export async function confirmGasInspectionAction(input: {
  propertyId: string;
  evidenceId: string;
  inspectionDate: string;
  anniversary: string;
}): Promise<ActionResult> {
  const session = await getSession();
  if (!session) return { ok: false, error: "Not signed in." };
  if (!input.inspectionDate || !input.anniversary) {
    return { ok: false, error: "Enter both the inspection date and the original anniversary." };
  }

  await confirmGasInspection(prisma, {
    accountId: session.account.id,
    evidenceId: input.evidenceId,
    inspectionDate: input.inspectionDate,
    anniversary: input.anniversary,
  });
  revalidate(input.propertyId);
  return { ok: true };
}

export async function removeCertificateAction(input: { propertyId: string; evidenceId: string }): Promise<ActionResult> {
  const session = await getSession();
  if (!session) return { ok: false, error: "Not signed in." };
  await removeEvidence(prisma, getStoragePort(), { accountId: session.account.id, evidenceId: input.evidenceId });
  revalidate(input.propertyId);
  return { ok: true };
}
