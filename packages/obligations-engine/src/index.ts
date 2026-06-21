// Public surface of the obligations engine. This package is the SOLE origin of
// every obligation status, due date, citation and basis. It has no dependency on
// web/api/prisma and contains no LLM call; the presentation layer may rephrase a
// `basis.summary` but must never contradict the status, dueDate or citation.

export * from "./types";
export { evaluate } from "./evaluate";
export { nextGasDue, gasDueDetail, recordGasInspection } from "./gas";
export type { GasDueDetail, GasDueOptions, RecordGasInspectionInput } from "./gas";
export {
  alwaysApplies,
  and,
  requiresGasSupply,
  requiresHmoLicence,
  requiresSelectiveLicensing,
  requiresAdditionalLicensing,
  hasTenantsToCheck,
  hmoLicensingTest,
  explainHmo,
  HMO_MIN_OCCUPANTS,
  HMO_MIN_HOUSEHOLDS,
  HMO_RULE_ID,
} from "./predicates";
export type { HmoExplanation } from "./predicates";
export {
  explainRentersRightsScope,
  rentersRightsScopeGate,
  RRA_MIN_ANNUAL_RENT_GBP,
  RRA_MAX_ANNUAL_RENT_GBP,
  RRA_SCOPE_RULE_ID,
} from "./scope";
export type { ScopeCondition, ScopeExplanation } from "./scope";
export { CITATIONS } from "./citations";
export type { CitationKey } from "./citations";
export { UK_RULES } from "./rules";
export {
  assessArrears,
  generateRentSchedule,
  ground8ThresholdUnits,
  GROUND8_MONTHS,
  GROUND8_WEEKS,
} from "./arrears";
export type {
  RentFrequency,
  RentReceipt,
  ScheduledPayment,
  ScheduleParams,
  StageAssessment,
  ArrearsAssessment,
  AssessArrearsInput,
} from "./arrears";
export { addDays, addMonths, daysBetween, compareISO, isoToUTC, toISODate } from "./dates";
