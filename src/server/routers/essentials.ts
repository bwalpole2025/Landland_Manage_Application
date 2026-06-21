import { z } from "zod";
import { router, accountProcedure } from "@/server/trpc";
import { DEFAULT_PROFILE, evaluateProperty, type PropertyEvaluation } from "@/server/compliance/evaluate";

export type EssentialsView = PropertyEvaluation;

const saveInput = z.object({
  propertyId: z.string().min(1),
  propertyType: z.enum(["flat", "house", "bedsit", "hmo", "other"]).nullable(),
  occupants: z.number().int().min(0).max(100).nullable(),
  households: z.number().int().min(0).max(100).nullable(),
  hasGasSupply: z.boolean(),
  selectiveLicensingArea: z.boolean(),
  annualRentGBP: z.number().int().min(0).max(100_000_000).nullable(),
  tenantIsIndividual: z.boolean(),
  tenantOnlyOrMainHome: z.boolean(),
  landlordResident: z.boolean(),
});

export const essentialsRouter = router({
  get: accountProcedure
    .input(z.object({ propertyId: z.string().min(1) }))
    .query(({ ctx, input }): Promise<EssentialsView> =>
      evaluateProperty(ctx.prisma, ctx.accountId, input.propertyId),
    ),

  save: accountProcedure.input(saveInput).mutation(async ({ ctx, input }): Promise<EssentialsView> => {
    const { propertyId, ...fields } = input;
    await ctx.prisma.applicabilityProfile.upsert({
      where: { accountId_propertyId: { accountId: ctx.accountId, propertyId } },
      create: { accountId: ctx.accountId, propertyId, ...fields },
      update: { ...fields },
    });
    // Recompute from the freshly-saved profile + confirmed evidence.
    return evaluateProperty(ctx.prisma, ctx.accountId, propertyId, { ...DEFAULT_PROFILE, ...fields });
  }),
});
