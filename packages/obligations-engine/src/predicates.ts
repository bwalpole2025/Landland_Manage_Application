// Applicability predicates. Each returns whether a rule applies AND a reason,
// so a not_applicable obligation can explain itself rather than misleadingly
// reading as "compliant".

import { CITATIONS } from "./citations";
import type { ApplicabilityContext, ApplicabilityOutcome, ApplicabilityPredicate, ApplicabilityProfile } from "./types";

/** Applies to every dwelling (e.g. EICR, EPC for a let property). */
export const alwaysApplies: ApplicabilityPredicate = () => ({
  applies: true,
  reason: "Applies to all let dwellings.",
});

/**
 * Conjunction of predicates. Returns the FIRST failing outcome (so a gated rule
 * explains itself with the gate's reason, e.g. out-of-scope cites the RRA); when
 * all pass, returns the LAST (most specific) outcome.
 */
export function and(...predicates: ApplicabilityPredicate[]): ApplicabilityPredicate {
  return (ctx: ApplicabilityContext): ApplicabilityOutcome => {
    let last: ApplicabilityOutcome = { applies: true, reason: "Applies." };
    for (const predicate of predicates) {
      last = predicate(ctx);
      if (!last.applies) return last;
    }
    return last;
  };
}

/** Selective licensing: only inside a designated area. */
export const requiresSelectiveLicensing: ApplicabilityPredicate = ({ profile }) =>
  profile.selectiveLicensingArea === true
    ? { applies: true, reason: "Property is in a designated selective-licensing area." }
    : { applies: false, reason: "Not in a designated selective-licensing area." };

/** Additional HMO licensing: only inside a designated area. */
export const requiresAdditionalLicensing: ApplicabilityPredicate = ({ profile }) =>
  profile.additionalLicensingArea === true
    ? { applies: true, reason: "Property is in a designated additional-licensing area." }
    : { applies: false, reason: "Not in a designated additional-licensing area." };

/** Right to Rent applies once there are tenants to check (England). */
export const hasTenantsToCheck: ApplicabilityPredicate = ({ property }) =>
  property.rightToRent?.hasTenants === true
    ? { applies: true, reason: "Property has tenants requiring Right to Rent checks." }
    : { applies: false, reason: "No tenants on record to check." };

/** Gas safety: only where there is a gas supply/appliance. */
export const requiresGasSupply: ApplicabilityPredicate = ({ profile }) =>
  profile.hasGasSupply === true
    ? { applies: true, reason: "Property has a gas supply." }
    : { applies: false, reason: "No gas supply at this property." };

/**
 * England mandatory HMO licensing test: a house in multiple occupation occupied
 * by 5 or more people forming 2 or more separate households. (Storey count was
 * removed from the mandatory threshold in 2018.)
 */
export function hmoLicensingTest(profile: ApplicabilityProfile): ApplicabilityOutcome {
  const occupants = profile.occupants ?? 0;
  const households = profile.households ?? 0;
  const applies = occupants >= 5 && households >= 2;
  return {
    applies,
    reason: applies
      ? `Licensable HMO: ${occupants} occupants across ${households} households.`
      : `Not a licensable HMO (needs 5+ occupants across 2+ households; has ${occupants} across ${households}).`,
  };
}

/** Predicate form of the HMO test, for use on a Rule. */
export const requiresHmoLicence: ApplicabilityPredicate = ({ profile }) => hmoLicensingTest(profile);

export const HMO_MIN_OCCUPANTS = 5;
export const HMO_MIN_HOUSEHOLDS = 2;
export const HMO_RULE_ID = "hmo-licence";

export interface HmoExplanation {
  isHmo: boolean;
  occupants: number;
  households: number;
  ruleId: string;
  citation: string;
  summary: string;
}

/** Explicit, explained outcome for "is this an HMO?". */
export function explainHmo(profile: ApplicabilityProfile): HmoExplanation {
  const occupants = profile.occupants ?? 0;
  const households = profile.households ?? 0;
  const { applies, reason } = hmoLicensingTest(profile);
  return {
    isHmo: applies,
    occupants,
    households,
    ruleId: HMO_RULE_ID,
    citation: CITATIONS.hmoLicence,
    summary: reason,
  };
}
