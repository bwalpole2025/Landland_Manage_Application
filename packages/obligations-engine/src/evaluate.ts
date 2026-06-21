// The evaluation engine. Pure and total: given a property, an applicability
// profile, a set of rules and an `asOf` date, it returns one EvaluatedObligation
// per *in-force, jurisdiction-matched* rule. It is the SOLE origin of every
// status, dueDate, citation and basis. No web/api/prisma, no LLM.

import { addDays, addMonths, compareISO, daysBetween } from "./dates";
import { gasDueDetail } from "./gas";
import type {
  ApplicabilityProfile,
  BasisCode,
  Cadence,
  EvaluatedObligation,
  Evidence,
  FactRef,
  ObligationBasis,
  ObligationCheck,
  ObligationStatus,
  Property,
  Rule,
} from "./types";

const DEFAULT_WARNING_DAYS = 60;

/** Step 1: a rule is selected when its jurisdiction matches and asOf is in its window. */
function isInForce(rule: Rule, property: Property, asOf: string): boolean {
  const jurisdictionMatch = rule.jurisdictions.some(
    (j) => j.toLowerCase() === property.jurisdiction.toLowerCase(),
  );
  if (!jurisdictionMatch) return false;
  if (compareISO(asOf, rule.effectiveFrom) < 0) return false;
  if (rule.effectiveTo !== null && compareISO(asOf, rule.effectiveTo) > 0) return false;
  return true;
}

/** Newest evidence of a type (by performedOn), and the full matching set. */
function selectEvidence(evidenceType: string, evidence: Evidence[]): { newest: Evidence | null; ids: string[] } {
  const matching = evidence
    .filter((e) => e.type === evidenceType)
    .sort((a, b) => compareISO(b.performedOn, a.performedOn)); // newest first
  return { newest: matching[0] ?? null, ids: matching.map((e) => e.id) };
}

/** Read an ISO-date fact from the property (deposit/tenancy); null when absent. */
function getFact(property: Property, ref: FactRef): string | null {
  const source = ref.source === "deposit" ? property.deposit : property.tenancy;
  const value = source ? (source as Record<string, unknown>)[ref.field as string] : undefined;
  return typeof value === "string" && value.length > 0 ? value : null;
}

interface CheckResult {
  status: ObligationStatus;
  dueDate: string | null;
  evidenceIds: string[];
  basis: ObligationBasis;
}

/**
 * Non-certificate obligations: deadline (act within N days of a reference date)
 * and attestation (the action simply must have happened). Status from facts and
 * time only — late or missing actions are non-compliant, never "compliant".
 */
function evaluateCheck(check: ObligationCheck, property: Property, asOf: string, title: string): CheckResult {
  if (check.kind === "right_to_rent") {
    const rr = property.rightToRent ?? {};
    if (!rr.checksComplete) {
      return { status: "overdue", dueDate: null, evidenceIds: [], basis: basis("overdue", `${title} — not every tenant has a completed Right to Rent check.`, { checksComplete: false }) };
    }
    if (!rr.recheckDue) {
      return { status: "compliant", dueDate: null, evidenceIds: [], basis: basis("compliant", `${title} — all tenants checked; no re-check due.`, { checksComplete: true }) };
    }
    const days = daysBetween(asOf, rr.recheckDue);
    if (days < 0) return { status: "overdue", dueDate: rr.recheckDue, evidenceIds: [], basis: basis("overdue", `${title} — re-check was due ${rr.recheckDue} (${Math.abs(days)} day(s) ago).`, { recheckDue: rr.recheckDue }) };
    if (days <= DEFAULT_WARNING_DAYS) return { status: "due_soon", dueDate: rr.recheckDue, evidenceIds: [], basis: basis("due_soon", `${title} — re-check due ${rr.recheckDue} (in ${days} day(s)).`, { recheckDue: rr.recheckDue }) };
    return { status: "compliant", dueDate: rr.recheckDue, evidenceIds: [], basis: basis("compliant", `${title} — next re-check due ${rr.recheckDue}.`, { recheckDue: rr.recheckDue }) };
  }

  if (check.kind === "attestation") {
    const satisfied = getFact(property, check.satisfiedBy);
    return satisfied
      ? { status: "compliant", dueDate: null, evidenceIds: [], basis: basis("compliant", `${title} — provided on ${satisfied}.`, { satisfiedOn: satisfied }) }
      : { status: "overdue", dueDate: null, evidenceIds: [], basis: basis("overdue", `${title} has not been provided.`, { satisfied: false }) };
  }

  // deadline
  const refDate = getFact(property, check.ref);
  if (!refDate) {
    return { status: "not_applicable", dueDate: null, evidenceIds: [], basis: basis("not_applicable", `${title} — no ${check.ref.source} record yet.`, {}) };
  }
  const deadline = addDays(refDate, check.windowDays);
  const satisfied = getFact(property, check.satisfiedBy);

  if (satisfied) {
    const onTime = compareISO(satisfied, deadline) <= 0;
    return onTime
      ? { status: "compliant", dueDate: deadline, evidenceIds: [], basis: basis("compliant", `${title} — done on ${satisfied}, within the ${check.windowDays}-day deadline (${deadline}).`, { satisfiedOn: satisfied, deadline }) }
      : { status: "overdue", dueDate: deadline, evidenceIds: [], basis: basis("overdue", `${title} — done on ${satisfied}, AFTER the ${check.windowDays}-day deadline (${deadline}); late action does not cure the breach.`, { satisfiedOn: satisfied, deadline, late: true }) };
  }

  const days = daysBetween(asOf, deadline);
  return days < 0
    ? { status: "overdue", dueDate: deadline, evidenceIds: [], basis: basis("overdue", `${title} — the ${check.windowDays}-day deadline (${deadline}) has passed and it is still outstanding.`, { deadline, outstanding: true }) }
    : { status: "due_soon", dueDate: deadline, evidenceIds: [], basis: basis("due_soon", `${title} — due by ${deadline} (in ${days} day(s)).`, { deadline, outstanding: true }) };
}

interface DueComputation {
  dueDate: string;
  facts: Record<string, string | number | boolean | null>;
}

/** Due date from the newest evidence, applying gas anniversary preservation when set. */
function computeDue(cadence: Cadence, evidence: Evidence): DueComputation {
  // A CONFIRMED expiry printed on the certificate is the authoritative due date
  // for ANY kind (including gas) — it wins over derived/anniversary dates. This
  // is the structural fact the engine reads once a landlord confirms it.
  if (evidence.expiresOn) {
    return {
      dueDate: evidence.expiresOn,
      facts: { performedOn: evidence.performedOn, source: "confirmed_expiry" },
    };
  }

  if (cadence.anniversaryPreservation) {
    const anchor = evidence.anniversary ?? evidence.performedOn;
    const detail = gasDueDetail(evidence.performedOn, anchor, {
      intervalMonths: cadence.intervalMonths,
      graceMonths: cadence.graceMonths,
    });
    return {
      dueDate: detail.dueDate,
      facts: {
        inspectionDate: evidence.performedOn,
        anniversary: anchor,
        anchorMode: evidence.anniversary ? detail.mode : "initial",
        graceWindowStart: detail.windowStart,
      },
    };
  }

  // Otherwise derive from the cadence interval.
  const dueDate = addMonths(evidence.performedOn, cadence.intervalMonths);
  return { dueDate, facts: { performedOn: evidence.performedOn, intervalMonths: cadence.intervalMonths } };
}

/** Step 3: status is a function of evidence + time ONLY. */
function statusFor(dueDate: string, asOf: string, warningDays: number): ObligationStatus {
  const days = daysBetween(asOf, dueDate);
  if (days < 0) return "overdue";
  if (days <= warningDays) return "due_soon";
  return "compliant";
}

function basis(code: BasisCode, summary: string, facts: ObligationBasis["facts"]): ObligationBasis {
  return { code, summary, facts };
}

/**
 * Plain-language explanation of a gas next-due date, derived from the anchoring
 * mode the engine chose. Returns null for non-gas (or confirmed-expiry) evidence.
 */
function gasReason(facts: ObligationBasis["facts"], dueDate: string): string | null {
  const mode = facts.anchorMode;
  if (typeof mode !== "string") return null;
  const anniversary = String(facts.anniversary ?? "");
  const windowStart = String(facts.graceWindowStart ?? "");
  switch (mode) {
    case "preserved":
      return `Renewed within the 2-month grace window (on/after ${windowStart}), so the ${anniversary} anniversary is preserved — next due ${dueDate}.`;
    case "reset":
      return `Inspected before the 2-month grace window, so the anchor reset to the inspection date + 12 months — next due ${dueDate}.`;
    case "late":
      return `Late renewal (after the anniversary), so it re-anchored to the inspection date + 12 months — next due ${dueDate}.`;
    case "initial":
      return `First certificate on record, so the next due is the inspection date + 12 months — ${dueDate}.`;
    default:
      return null;
  }
}

function evaluateRule(
  rule: Rule,
  property: Property,
  profile: ApplicabilityProfile,
  evidence: Evidence[],
  asOf: string,
): EvaluatedObligation {
  const base = { ruleId: rule.id, citation: rule.citation, title: rule.title, blocksPossession: rule.blocksPossession };
  const warningDays = rule.warningDays ?? DEFAULT_WARNING_DAYS;

  // Step 2: applicability filter — a non-applicable rule is never "compliant".
  const outcome = rule.applicability({ property, profile });
  if (!outcome.applies) {
    return {
      ...base,
      status: "not_applicable",
      dueDate: null,
      evidenceIds: [],
      basis: basis("not_applicable", outcome.reason, { applies: false }),
    };
  }

  // Non-certificate obligations (deposit/tenancy): deadline / attestation checks.
  if (rule.check) {
    return { ...base, ...evaluateCheck(rule.check, property, asOf, rule.title) };
  }

  // Step 3 (certificate): compute from cadence + newest satisfying evidence.
  if (!rule.cadence || !rule.evidenceType) {
    return { ...base, status: "not_applicable", dueDate: null, evidenceIds: [], basis: basis("not_applicable", `${rule.title}: no check configured.`, {}) };
  }
  const { newest, ids } = selectEvidence(rule.evidenceType, evidence);
  if (!newest) {
    return {
      ...base,
      status: "overdue",
      dueDate: null,
      evidenceIds: [],
      basis: basis("no_evidence", `No ${rule.evidenceType} evidence on record; action required.`, {
        applies: true,
        evidenceType: rule.evidenceType,
      }),
    };
  }

  const { dueDate, facts } = computeDue(rule.cadence, newest);
  const status = statusFor(dueDate, asOf, warningDays);
  const daysUntilDue = daysBetween(asOf, dueDate);

  const code: BasisCode = status === "overdue" ? "overdue" : status === "due_soon" ? "due_soon" : "compliant";
  const statusSummary =
    status === "overdue"
      ? `${rule.title} expired on ${dueDate} (${Math.abs(daysUntilDue)} day(s) ago).`
      : status === "due_soon"
        ? `${rule.title} due on ${dueDate} (in ${daysUntilDue} day(s)) — within the ${warningDays}-day warning window.`
        : `${rule.title} valid until ${dueDate} (${daysUntilDue} day(s) away).`;

  // Gas: explain WHY the next-due date is what it is (anniversary preservation).
  const why = gasReason(facts, dueDate);
  const summary = why ? `${statusSummary} ${why}` : statusSummary;

  return {
    ...base,
    status,
    dueDate,
    evidenceIds: ids,
    basis: basis(code, summary, { ...facts, dueDate, daysUntilDue, warningDays, evidenceId: newest.id }),
  };
}

/**
 * Evaluate a property's compliance obligations as of a given date.
 *
 * @param property  the dwelling — jurisdiction drives selection; `evidence`
 *                  holds its certificates/inspections
 * @param profile   applicability inputs (gas supply, HMO test, …)
 * @param rules     the rule set to evaluate
 * @param asOf      ISO date the evaluation is anchored to
 */
export function evaluate(
  property: Property,
  profile: ApplicabilityProfile,
  rules: Rule[],
  asOf: string,
): EvaluatedObligation[] {
  const evidence = property.evidence ?? [];
  return rules
    .filter((rule) => isInForce(rule, property, asOf)) // Step 1: SELECT
    .map((rule) => evaluateRule(rule, property, profile, evidence, asOf));
}
