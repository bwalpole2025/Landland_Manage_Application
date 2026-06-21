// The canonical UK rule rows. Each compliance rule is wrapped in the Renters'
// Rights Act scope gate via `and(...)`, so a tenancy outside the assured-tenancy
// regime produces "not_applicable" obligations (citing the RRA), never an empty
// or compliant list.

import { CITATIONS } from "./citations";
import {
  alwaysApplies,
  and,
  hasTenantsToCheck,
  requiresAdditionalLicensing,
  requiresGasSupply,
  requiresHmoLicence,
  requiresSelectiveLicensing,
} from "./predicates";
import { rentersRightsScopeGate } from "./scope";
import type { Rule } from "./types";

export const UK_RULES: Rule[] = [
  {
    id: "gas-safety",
    citation: CITATIONS.gas,
    title: "Annual gas safety check",
    jurisdictions: ["england", "wales"],
    effectiveFrom: "1998-10-31",
    effectiveTo: null,
    evidenceType: "gas_safety",
    cadence: { intervalMonths: 12, anniversaryPreservation: true, graceMonths: 2 },
    applicability: and(rentersRightsScopeGate, requiresGasSupply),
    warningDays: 60,
  },
  {
    id: "eicr",
    citation: CITATIONS.eicr,
    title: "Electrical installation condition report (EICR)",
    jurisdictions: ["england"],
    effectiveFrom: "2020-06-01",
    effectiveTo: null,
    evidenceType: "eicr",
    cadence: { intervalMonths: 60 }, // 5-yearly
    applicability: and(rentersRightsScopeGate, alwaysApplies),
    warningDays: 60,
  },
  {
    id: "smoke-co-alarm",
    citation: CITATIONS.smokeCoAlarm,
    title: "Smoke & CO alarm check",
    jurisdictions: ["england"],
    effectiveFrom: "2015-10-01",
    effectiveTo: null,
    evidenceType: "smoke_co_alarm",
    cadence: { intervalMonths: 12 }, // periodic working-order check
    applicability: and(rentersRightsScopeGate, alwaysApplies),
    warningDays: 60,
  },
  {
    id: "epc",
    citation: CITATIONS.epc,
    title: "Energy Performance Certificate (EPC)",
    jurisdictions: ["england", "wales"],
    effectiveFrom: "2008-10-01",
    effectiveTo: null,
    evidenceType: "epc",
    cadence: { intervalMonths: 120 }, // 10-yearly
    applicability: and(rentersRightsScopeGate, alwaysApplies),
    warningDays: 60,
  },
  {
    id: "hmo-licence",
    citation: CITATIONS.hmoLicence,
    title: "Mandatory HMO licence",
    jurisdictions: ["england"],
    effectiveFrom: "2006-04-06",
    effectiveTo: null,
    evidenceType: "hmo_licence",
    cadence: { intervalMonths: 60 },
    applicability: and(rentersRightsScopeGate, requiresHmoLicence),
    warningDays: 90,
  },
  {
    id: "selective-licence",
    citation: CITATIONS.selectiveLicence,
    title: "Selective licence",
    jurisdictions: ["england"],
    effectiveFrom: "2006-04-06",
    effectiveTo: null,
    evidenceType: "selective_licence",
    cadence: { intervalMonths: 60 },
    applicability: and(rentersRightsScopeGate, requiresSelectiveLicensing),
    warningDays: 90,
  },
  {
    id: "additional-licence",
    citation: CITATIONS.additionalLicence,
    title: "Additional HMO licence",
    jurisdictions: ["england"],
    effectiveFrom: "2006-04-06",
    effectiveTo: null,
    evidenceType: "additional_licence",
    cadence: { intervalMonths: 60 },
    applicability: and(rentersRightsScopeGate, requiresAdditionalLicensing),
    warningDays: 90,
  },
  {
    id: "right-to-rent",
    citation: CITATIONS.rightToRent,
    title: "Right to Rent checks",
    jurisdictions: ["england"],
    effectiveFrom: "2014-12-01",
    effectiveTo: null,
    applicability: and(rentersRightsScopeGate, hasTenantsToCheck),
    check: { kind: "right_to_rent" },
    warningDays: 60,
  },

  // --- Deposit (deadline checks; non-compliance blocks a possession claim) ---
  {
    id: "deposit-protection",
    citation: CITATIONS.depositProtection,
    title: "Deposit protected in a scheme",
    jurisdictions: ["england", "wales"],
    effectiveFrom: "2007-04-06",
    effectiveTo: null,
    applicability: and(rentersRightsScopeGate, alwaysApplies),
    check: {
      kind: "deadline",
      ref: { source: "deposit", field: "receivedOn" },
      windowDays: 30,
      satisfiedBy: { source: "deposit", field: "protectedOn" },
    },
    blocksPossession: true,
  },
  {
    id: "deposit-prescribed-information",
    citation: CITATIONS.depositPrescribedInfo,
    title: "Prescribed information served",
    jurisdictions: ["england", "wales"],
    effectiveFrom: "2007-04-06",
    effectiveTo: null,
    applicability: and(rentersRightsScopeGate, alwaysApplies),
    check: {
      kind: "deadline",
      ref: { source: "deposit", field: "receivedOn" },
      windowDays: 30,
      satisfiedBy: { source: "deposit", field: "prescribedInfoServedOn" },
    },
    blocksPossession: true,
  },

  // --- Tenancy (written terms deadline; information-provision attestation) ---
  {
    id: "tenancy-written-terms",
    citation: CITATIONS.writtenStatement,
    title: "Written statement of terms provided",
    jurisdictions: ["england"],
    effectiveFrom: "2025-01-01",
    effectiveTo: null,
    applicability: and(rentersRightsScopeGate, alwaysApplies),
    check: {
      kind: "deadline",
      ref: { source: "tenancy", field: "startDate" },
      windowDays: 28,
      satisfiedBy: { source: "tenancy", field: "writtenTermsProvidedOn" },
    },
  },
  {
    id: "tenancy-information-provision",
    citation: CITATIONS.informationProvision,
    title: "Tenant information provided",
    jurisdictions: ["england"],
    effectiveFrom: "2025-01-01",
    effectiveTo: null,
    applicability: and(rentersRightsScopeGate, alwaysApplies),
    check: {
      kind: "attestation",
      satisfiedBy: { source: "tenancy", field: "informationProvidedOn" },
    },
  },
];
