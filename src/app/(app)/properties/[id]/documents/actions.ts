"use server";

import { revalidatePath } from "next/cache";
import { getSession } from "@/server/auth/session";
import { prisma } from "@/server/db";
import { getStoragePort } from "@/server/storage";
import { confirmExpiry, removeEvidence, uploadEvidence } from "@/server/documents/service";
import type { EvidenceKind } from "@prisma/client";

const KINDS: EvidenceKind[] = [
  "GAS_SAFETY",
  "EICR",
  "EPC",
  "INSURANCE",
  "DEPOSIT_PROTECTION",
  "HMO_LICENCE",
  "SELECTIVE_LICENCE",
  "OTHER",
];

export type ActionResult = { ok: true } | { ok: false; error: string };

export async function uploadEvidenceAction(formData: FormData): Promise<ActionResult> {
  const session = await getSession();
  if (!session) return { ok: false, error: "Not signed in." };

  const propertyId = String(formData.get("propertyId") ?? "");
  const kind = String(formData.get("kind") ?? "OTHER") as EvidenceKind;
  const proposedExpiresOn = String(formData.get("proposedExpiresOn") ?? "") || null;
  const file = formData.get("file");

  if (!propertyId) return { ok: false, error: "Missing property." };
  if (!KINDS.includes(kind)) return { ok: false, error: "Invalid document type." };
  if (!(file instanceof File) || file.size === 0) return { ok: false, error: "Choose a file to upload." };

  const bytes = new Uint8Array(await file.arrayBuffer());
  await uploadEvidence(prisma, getStoragePort(), {
    accountId: session.account.id,
    ownerId: session.account.id, // tenant boundary = storage-RLS owner (leading key segment)
    propertyId,
    kind,
    filename: file.name || "document",
    contentType: file.type || "application/octet-stream",
    body: bytes,
    proposedExpiresOn, // only a PROPOSAL — not authoritative
  });

  revalidatePath(`/properties/${propertyId}/documents`);
  return { ok: true };
}

export async function confirmExpiryAction(input: {
  propertyId: string;
  evidenceId: string;
  expiresOn: string;
}): Promise<ActionResult> {
  const session = await getSession();
  if (!session) return { ok: false, error: "Not signed in." };
  if (!input.expiresOn) return { ok: false, error: "Enter the expiry date to confirm." };

  await confirmExpiry(prisma, { accountId: session.account.id, evidenceId: input.evidenceId, expiresOn: input.expiresOn });
  revalidatePath(`/properties/${input.propertyId}/documents`);
  revalidatePath(`/properties/${input.propertyId}/essentials`); // an obligation status may change
  return { ok: true };
}

export async function removeEvidenceAction(input: { propertyId: string; evidenceId: string }): Promise<ActionResult> {
  const session = await getSession();
  if (!session) return { ok: false, error: "Not signed in." };

  await removeEvidence(prisma, getStoragePort(), { accountId: session.account.id, evidenceId: input.evidenceId });
  revalidatePath(`/properties/${input.propertyId}/documents`);
  revalidatePath(`/properties/${input.propertyId}/essentials`);
  return { ok: true };
}
