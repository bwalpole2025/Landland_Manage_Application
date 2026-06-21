"use server";

import { revalidatePath } from "next/cache";
import { getSession } from "@/server/auth/session";
import { createProperty, type CreatePropertyInput } from "@/services/repository";

export type CreatePropertyResult = { ok: true; id: string } | { ok: false; error: string };

export async function createPropertyAction(input: CreatePropertyInput): Promise<CreatePropertyResult> {
  const session = await getSession();
  if (!session) return { ok: false, error: "Not signed in." };

  const nickname = input.nickname.trim();
  if (!nickname) return { ok: false, error: "Give the property a name." };
  if (!input.line1.trim() || !input.city.trim() || !input.postcode.trim()) {
    return { ok: false, error: "Address line, city and postcode are required." };
  }

  const property = createProperty({
    nickname,
    line1: input.line1.trim(),
    city: input.city.trim(),
    postcode: input.postcode.trim().toUpperCase(),
    type: input.type,
    bedrooms: Math.max(0, Math.floor(input.bedrooms)),
    portfolioId: input.portfolioId,
  });

  revalidatePath("/properties");
  return { ok: true, id: property.id };
}
