"use server";

import { revalidatePath } from "next/cache";
import { createDocument } from "@/services/repository";
import type { ComplianceDocType } from "@/lib/types";

export interface UploadDocumentInput {
  propertyId: string;
  tenancyId?: string;
  category: string;
  type: ComplianceDocType;
  title: string;
  issueDate?: string;
  expiryDate?: string;
  fileRef: string;
}

/**
 * "Upload" a document. When it has an expiry, it surfaces on the calendar and
 * its 30/14/7/1-day reminders are scheduled — so we revalidate both pages.
 */
export async function uploadDocumentAction(input: UploadDocumentInput): Promise<void> {
  createDocument(input);
  revalidatePath("/files");
  revalidatePath("/files/calendar");
  revalidatePath("/files/reminders");
}
