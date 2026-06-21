// Renters' Rights Act in-scope test. This is the GATE that sits in front of
// every other obligation: a tenancy outside the assured-tenancy regime yields
// "not_applicable" obligations — never a misleading empty or compliant list.
//
// The four conditions (all must hold):
//   1. annual rent is between £250 and £100,000 (inclusive);
//   2. the tenant is an individual (not a company);
//   3. the property is the tenant's only or main home;
//   4. the landlord is not resident in the same dwelling.

import { CITATIONS } from "./citations";
import type { ApplicabilityContext, ApplicabilityOutcome, ApplicabilityPredicate, ApplicabilityProfile } from "./types";

export const RRA_MIN_ANNUAL_RENT_GBP = 250;
export const RRA_MAX_ANNUAL_RENT_GBP = 100_000;
export const RRA_SCOPE_RULE_ID = "rra-scope";

export interface ScopeCondition {
  id: "rent" | "individual_tenant" | "main_home" | "non_resident_landlord";
  label: string;
  pass: boolean;
  detail: string;
}

export interface ScopeExplanation {
  inScope: boolean;
  ruleId: string;
  citation: string;
  conditions: ScopeCondition[];
  summary: string;
}

/** Explicit, condition-by-condition reasoning for the in-scope test. */
export function explainRentersRightsScope(profile: ApplicabilityProfile): ScopeExplanation {
  const rent = profile.annualRentGBP;
  const rentInRange = typeof rent === "number" && rent >= RRA_MIN_ANNUAL_RENT_GBP && rent <= RRA_MAX_ANNUAL_RENT_GBP;

  const conditions: ScopeCondition[] = [
    {
      id: "rent",
      label: `Annual rent between £${RRA_MIN_ANNUAL_RENT_GBP.toLocaleString("en-GB")} and £${RRA_MAX_ANNUAL_RENT_GBP.toLocaleString("en-GB")}`,
      pass: rentInRange,
      detail: typeof rent === "number" ? `Rent is £${rent.toLocaleString("en-GB")}/yr` : "Rent not provided",
    },
    {
      id: "individual_tenant",
      label: "Tenant is an individual",
      pass: profile.tenantIsIndividual === true,
      detail: profile.tenantIsIndividual === true ? "Individual tenant" : "Not an individual (e.g. company let)",
    },
    {
      id: "main_home",
      label: "Property is the tenant's only or main home",
      pass: profile.tenantOnlyOrMainHome === true,
      detail: profile.tenantOnlyOrMainHome === true ? "Only or main home" : "Not the tenant's only/main home",
    },
    {
      id: "non_resident_landlord",
      label: "Landlord is not resident",
      pass: profile.landlordResident === false,
      detail: profile.landlordResident === false ? "Non-resident landlord" : "Resident landlord (or not stated)",
    },
  ];

  const inScope = conditions.every((c) => c.pass);
  const failed = conditions.filter((c) => !c.pass).map((c) => c.label.toLowerCase());
  const summary = inScope
    ? "Within the Renters' Rights Act assured-tenancy regime."
    : `Out of scope of the Renters' Rights Act — fails: ${failed.join("; ")}.`;

  return { inScope, ruleId: RRA_SCOPE_RULE_ID, citation: CITATIONS.rraScope, conditions, summary };
}

/** Predicate form: the gate every compliance rule is wrapped in. */
export const rentersRightsScopeGate: ApplicabilityPredicate = ({ profile }: ApplicabilityContext): ApplicabilityOutcome => {
  const explanation = explainRentersRightsScope(profile);
  return {
    applies: explanation.inScope,
    reason: explanation.inScope
      ? "Tenancy is within the Renters' Rights Act regime."
      : `${explanation.summary} (${explanation.citation})`,
  };
};
