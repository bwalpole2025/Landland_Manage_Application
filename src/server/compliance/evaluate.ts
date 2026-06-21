// Shared compliance evaluation: load a property's applicability profile +
// CONFIRMED evidence and run the obligations engine. The single place the app
// invokes the engine, so Essentials, Safety and anything else stay consistent —
// every status, dueDate and basis comes from here, never from a component.

import type { PrismaClient } from "@prisma/client";
import {
  evaluate,
  explainHmo,
  explainRentersRightsScope,
  UK_RULES,
  type ApplicabilityProfile,
  type DwellingType,
  type EvaluatedObligation,
  type HmoExplanation,
  type Property,
  type ScopeExplanation,
} from "@obligations-engine";
import { confirmedEngineEvidence } from "@/server/documents/service";
import { loadCurrentTenancyFacts, loadDepositFacts } from "@/server/compliance/records";
import { loadLicenceEvidence } from "@/server/compliance/licensing";
import { loadRightToRentFacts } from "@/server/compliance/tenants";
import { todayISO } from "@/lib/dates";
import { now } from "@/lib/clock";

// All seeded properties are in England; a real system derives this from the
// property's address/postcode.
export const JURISDICTION = "england";

/** The resolved applicability profile (engine inputs, fully defaulted). */
export interface ResolvedProfile {
  propertyType: DwellingType | null;
  occupants: number | null;
  households: number | null;
  hasGasSupply: boolean;
  selectiveLicensingArea: boolean;
  annualRentGBP: number | null;
  tenantIsIndividual: boolean;
  tenantOnlyOrMainHome: boolean;
  landlordResident: boolean;
}

export const DEFAULT_PROFILE: ResolvedProfile = {
  propertyType: null,
  occupants: null,
  households: null,
  hasGasSupply: false,
  selectiveLicensingArea: false,
  annualRentGBP: null,
  tenantIsIndividual: true,
  tenantOnlyOrMainHome: true,
  landlordResident: false,
};

export function toEngineProfile(p: ResolvedProfile): ApplicabilityProfile {
  return {
    propertyType: p.propertyType ?? undefined,
    occupants: p.occupants ?? undefined,
    households: p.households ?? undefined,
    hasGasSupply: p.hasGasSupply,
    selectiveLicensingArea: p.selectiveLicensingArea,
    annualRentGBP: p.annualRentGBP ?? undefined,
    tenantIsIndividual: p.tenantIsIndividual,
    tenantOnlyOrMainHome: p.tenantOnlyOrMainHome,
    landlordResident: p.landlordResident,
  };
}

export async function loadProfile(
  prisma: PrismaClient,
  accountId: string,
  propertyId: string,
): Promise<ResolvedProfile> {
  const row = await prisma.applicabilityProfile.findUnique({
    where: { accountId_propertyId: { accountId, propertyId } },
  });
  if (!row) return { ...DEFAULT_PROFILE };
  return {
    propertyType: (row.propertyType as DwellingType | null) ?? null,
    occupants: row.occupants,
    households: row.households,
    hasGasSupply: row.hasGasSupply,
    selectiveLicensingArea: row.selectiveLicensingArea,
    annualRentGBP: row.annualRentGBP,
    tenantIsIndividual: row.tenantIsIndividual,
    tenantOnlyOrMainHome: row.tenantOnlyOrMainHome,
    landlordResident: row.landlordResident,
  };
}

export interface PropertyEvaluation {
  profile: ResolvedProfile;
  evaluation: EvaluatedObligation[];
  scope: ScopeExplanation;
  hmo: HmoExplanation;
}

/**
 * Evaluate a property's obligations from its profile + CONFIRMED evidence.
 * `profileOverride` lets a just-saved profile be evaluated without re-reading.
 */
export async function evaluateProperty(
  prisma: PrismaClient,
  accountId: string,
  propertyId: string,
  profileOverride?: ResolvedProfile,
): Promise<PropertyEvaluation> {
  const profile = profileOverride ?? (await loadProfile(prisma, accountId, propertyId));
  const engineProfile = toEngineProfile(profile);
  const [evidence, deposit, tenancy, licenceEvidence, rightToRent] = await Promise.all([
    confirmedEngineEvidence(prisma, accountId, propertyId),
    loadDepositFacts(prisma, accountId, propertyId),
    loadCurrentTenancyFacts(prisma, accountId, propertyId),
    loadLicenceEvidence(prisma, accountId, propertyId),
    loadRightToRentFacts(prisma, accountId, propertyId),
  ]);
  const property: Property = {
    id: propertyId,
    jurisdiction: JURISDICTION,
    evidence: [...evidence, ...licenceEvidence],
    deposit,
    tenancy,
    rightToRent,
  };
  return {
    profile,
    evaluation: evaluate(property, engineProfile, UK_RULES, todayISO(now())),
    scope: explainRentersRightsScope(engineProfile),
    hmo: explainHmo(engineProfile),
  };
}
