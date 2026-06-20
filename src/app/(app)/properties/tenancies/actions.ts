"use server";

import { revalidatePath } from "next/cache";
import { createTenancy } from "@/services/repository";
import type { Tenancy } from "@/lib/types";

export interface CreateTenancyInput {
  propertyId: string;
  tenantName: string;
  tenantEmail?: string;
  rentPence: number;
  rentFrequency: "monthly" | "weekly";
  rentDueDay: number;
  depositPence?: number;
  startDate: string;
  endDate?: string;
}

/**
 * Create a tenancy and revalidate everywhere its schedule feeds: the tenancies
 * list, occupancy on the properties screen, and the dashboard + calendar
 * upcoming-payment widgets.
 */
export async function createTenancyAction(input: CreateTenancyInput): Promise<void> {
  const tenancy: Omit<Tenancy, "id" | "status"> = {
    propertyId: input.propertyId,
    tenants: [{ id: `tn_${Date.now()}`, name: input.tenantName, email: input.tenantEmail }],
    startDate: input.startDate,
    endDate: input.endDate,
    rentPence: input.rentPence,
    rentFrequency: input.rentFrequency,
    rentDueDay: input.rentDueDay,
    depositPence: input.depositPence,
  };
  createTenancy(tenancy);

  revalidatePath("/properties/tenancies");
  revalidatePath("/properties");
  revalidatePath("/dashboard");
  revalidatePath("/files/calendar");
}
