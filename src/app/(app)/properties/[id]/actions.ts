"use server";

import { revalidatePath } from "next/cache";
import { archiveProperty, restoreProperty, setPropertyPortfolio } from "@/services/repository";
import { now } from "@/lib/clock";

/** Archive a property — removes it from active lists, history is preserved. */
export async function archivePropertyAction(id: string): Promise<void> {
  archiveProperty(id, now().toISOString());
  revalidatePath("/properties");
  revalidatePath(`/properties/${id}`);
}

export async function restorePropertyAction(id: string): Promise<void> {
  restoreProperty(id);
  revalidatePath("/properties");
  revalidatePath(`/properties/${id}`);
}

export async function setPortfolioAction(id: string, portfolioId: string): Promise<void> {
  setPropertyPortfolio(id, portfolioId);
  revalidatePath("/properties");
  revalidatePath(`/properties/${id}`);
}
