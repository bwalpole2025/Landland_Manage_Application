// Domain types for the obligations engine. Deliberately minimal and self-
// contained — no imports from the host app, web, api or prisma.

export type ObligationStatus = "compliant" | "due_soon" | "overdue" | "not_applicable";

/** Deposit facts powering the deposit-protection / prescribed-information rules. */
export interface DepositFacts {
  /** Authorised scheme, e.g. "tds" | "dps" | "mydeposits"; null = none. */
  scheme?: string | null;
  /** Date the deposit was received (ISO date) — the deadline reference. */
  receivedOn?: string | null;
  /** Date the deposit was protected in a scheme (ISO date). */
  protectedOn?: string | null;
  /** Date the prescribed information was served (ISO date). */
  prescribedInfoServedOn?: string | null;
}

/** Tenancy facts powering the written-terms / information-provision rules. */
export interface TenancyFacts {
  /** e.g. "periodic_assured" | "fixed_term". */
  kind?: string | null;
  startDate?: string | null;
  /** Date the written statement of terms was provided (ISO date). */
  writtenTermsProvidedOn?: string | null;
  /** Date tenant information (How to Rent guide, etc.) was provided (ISO date). */
  informationProvidedOn?: string | null;
}

/** Right to Rent facts, derived from the property's tenant records. */
export interface RightToRentFacts {
  /** Whether there are tenants to check at all. */
  hasTenants?: boolean;
  /** Every tenant has a completed Right to Rent check. */
  checksComplete?: boolean;
  /** Earliest re-check due date among time-limited tenants (ISO date); null = none due. */
  recheckDue?: string | null;
}

/** The property under evaluation, including the facts/evidence held against it. */
export interface Property {
  id: string;
  /** e.g. "england", "wales", "scotland", "northern-ireland". */
  jurisdiction: string;
  /** Certificates / inspections (and licences mapped to evidence) on record. */
  evidence?: Evidence[];
  /** Current deposit facts. */
  deposit?: DepositFacts;
  /** Current tenancy facts. */
  tenancy?: TenancyFacts;
  /** Right to Rent facts derived from tenant records. */
  rightToRent?: RightToRentFacts;
}

/** Coarse dwelling classification. */
export type DwellingType = "flat" | "house" | "bedsit" | "hmo" | "other";

/**
 * Inputs that decide whether a rule applies. Extend as new predicates are added;
 * the engine never assumes a field is present (an absent field reads as the
 * conservative, not-in-scope value).
 */
export interface ApplicabilityProfile {
  /** Coarse property classification + occupancy. */
  propertyType?: DwellingType;
  /** True when the dwelling has a gas supply/appliance (gas-safety applicability). */
  hasGasSupply?: boolean;

  /** HMO test inputs. */
  occupants?: number;
  households?: number;

  /** Whether the property sits in a designated selective-licensing area. */
  selectiveLicensingArea?: boolean;
  /** Whether the property sits in a designated additional-HMO-licensing area. */
  additionalLicensingArea?: boolean;

  // --- Renters' Rights Act in-scope inputs ---
  /** Annual rent in whole pounds. */
  annualRentGBP?: number;
  /** The tenant is an individual (not a company/organisation). */
  tenantIsIndividual?: boolean;
  /** The property is the tenant's only or main home. */
  tenantOnlyOrMainHome?: boolean;
  /** The landlord lives in the same dwelling as the tenant. */
  landlordResident?: boolean;
}

/** Context handed to every applicability predicate. */
export interface ApplicabilityContext {
  property: Property;
  profile: ApplicabilityProfile;
}

/** Outcome of an applicability predicate — carries the reason for the basis. */
export interface ApplicabilityOutcome {
  applies: boolean;
  reason: string;
}

export type ApplicabilityPredicate = (ctx: ApplicabilityContext) => ApplicabilityOutcome;

/** How often an obligation must be renewed, and any special anchoring. */
export interface Cadence {
  /** Renewal interval in months (gas 12, EICR 60, EPC 120). */
  intervalMonths: number;
  /** Gas safety: preserve the anniversary when renewed inside the grace window. */
  anniversaryPreservation?: boolean;
  /** Gas grace window, in months before the anniversary (default 2). */
  graceMonths?: number;
}

/** A piece of evidence that can satisfy a rule (a certificate / inspection). */
export interface Evidence {
  id: string;
  /** Matches `Rule.evidenceType`, e.g. "gas_safety", "eicr", "epc". */
  type: string;
  /** Date the inspection was performed / certificate issued (ISO date). */
  performedOn: string;
  /** Explicit expiry (ISO date) when known; otherwise derived from cadence. */
  expiresOn?: string | null;
  /**
   * Gas-only: the auditable anchor anniversary this inspection renews (ISO
   * date). Persisted alongside `performedOn` so the anchor is never lost.
   */
  anniversary?: string;
}

/** A reference to a fact on the property (deposit/tenancy), read by checks. */
export type FactRef =
  | { source: "deposit"; field: keyof DepositFacts }
  | { source: "tenancy"; field: keyof TenancyFacts };

/**
 * How a non-certificate obligation is checked.
 *  - deadline: an action (`satisfiedBy`) must happen within `windowDays` of a
 *    reference date (`ref`). Late or missing → non-compliant. (e.g. protect the
 *    deposit within 30 days of receipt.)
 *  - attestation: an action (`satisfiedBy`) must simply have happened. Missing →
 *    non-compliant. (e.g. tenant information provided.)
 */
export type ObligationCheck =
  | { kind: "deadline"; ref: FactRef; windowDays: number; satisfiedBy: FactRef }
  | { kind: "attestation"; satisfiedBy: FactRef }
  | { kind: "right_to_rent" };

/** A compliance rule ("rule row" in the versioned rules table). */
export interface Rule {
  id: string;
  /** Legal citation — the engine is the sole origin of this in the output. */
  citation: string;
  title: string;
  /** Jurisdictions the rule applies in (matched against the property). */
  jurisdictions: string[];
  /** Window during which the rule is in force. */
  effectiveFrom: string;
  /** Inclusive end of the window; null = still in force. */
  effectiveTo: string | null;
  applicability: ApplicabilityPredicate;
  /** Certificate rules: the evidence type + renewal cadence. */
  evidenceType?: string;
  cadence?: Cadence;
  /** Non-certificate rules: a deadline/attestation check over property facts. */
  check?: ObligationCheck;
  /** When non-compliance blocks a possession claim (surfaced prominently). */
  blocksPossession?: boolean;
  /** Days before due to flag "due_soon" (default 60). */
  warningDays?: number;
}

/** Machine code identifying the reasoning branch behind a status. */
export type BasisCode =
  | "not_applicable"
  | "no_evidence"
  | "compliant"
  | "due_soon"
  | "overdue";

/** Gas anchoring outcome, surfaced in the basis facts for auditability. */
export type GasAnchorMode = "initial" | "preserved" | "reset" | "late";

/**
 * Structured, human-readable justification for a status/dueDate. The
 * presentation layer may rephrase `summary` but must never contradict the
 * `code`, `facts`, status or dueDate.
 */
export interface ObligationBasis {
  code: BasisCode;
  summary: string;
  facts: Record<string, string | number | boolean | null>;
}

export interface EvaluatedObligation {
  ruleId: string;
  citation: string;
  title: string;
  status: ObligationStatus;
  /** ISO date the obligation is/was due; null when not applicable or unknown. */
  dueDate: string | null;
  /** Evidence considered, newest first. */
  evidenceIds: string[];
  basis: ObligationBasis;
  /** True when non-compliance blocks a possession claim. */
  blocksPossession?: boolean;
}
