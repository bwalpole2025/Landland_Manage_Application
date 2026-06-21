// Gas-safety anniversary preservation — the load-bearing compliance rule.
//
// A gas safety certificate is valid for 12 months. To avoid "deadline drift"
// from early renewals, the regulations let you renew up to 2 months before the
// expiry/anniversary while KEEPING the original anniversary date:
//
//   - Inspection within the 2 months BEFORE the anniversary  -> anniversary + 12m   (PRESERVE)
//   - Inspection EARLIER than that window                     -> inspection + 12m    (RESET)
//   - LATE inspection (after the anniversary)                 -> inspection + 12m    (RE-ANCHOR)
//
// Each gas evidence record persists BOTH the inspection date and the original
// anniversary, so the anchor is auditable and never lost.

import { addMonths, compareISO } from "./dates";
import type { Evidence, GasAnchorMode } from "./types";

const DEFAULT_INTERVAL_MONTHS = 12;
const DEFAULT_GRACE_MONTHS = 2;

export interface GasDueOptions {
  /** Validity interval in months (default 12). */
  intervalMonths?: number;
  /** Grace window before the anniversary, in months (default 2). */
  graceMonths?: number;
}

export interface GasDueDetail {
  /** ISO date the next certificate is due. */
  dueDate: string;
  /** Which anchoring branch produced the due date. */
  mode: Extract<GasAnchorMode, "preserved" | "reset" | "late">;
  /** Start of the grace window (anniversary − graceMonths), for auditability. */
  windowStart: string;
}

/**
 * The next gas-safety due date given an inspection and the anniversary it
 * renews, plus which anchoring branch applied. `nextGasDue` is the thin wrapper
 * most callers want; this exposes the reasoning for the basis.
 */
export function gasDueDetail(
  inspectionDate: string,
  anniversary: string,
  options: GasDueOptions = {},
): GasDueDetail {
  const intervalMonths = options.intervalMonths ?? DEFAULT_INTERVAL_MONTHS;
  const graceMonths = options.graceMonths ?? DEFAULT_GRACE_MONTHS;
  const windowStart = addMonths(anniversary, -graceMonths);

  const onOrAfterWindowStart = compareISO(inspectionDate, windowStart) >= 0;
  const onOrBeforeAnniversary = compareISO(inspectionDate, anniversary) <= 0;

  if (onOrAfterWindowStart && onOrBeforeAnniversary) {
    // Renewed inside the grace window → keep the original anniversary.
    return { dueDate: addMonths(anniversary, intervalMonths), mode: "preserved", windowStart };
  }
  if (!onOrBeforeAnniversary) {
    // Inspected after the anniversary → late renewal re-anchors.
    return { dueDate: addMonths(inspectionDate, intervalMonths), mode: "late", windowStart };
  }
  // Inspected earlier than the grace window → resets the anchor.
  return { dueDate: addMonths(inspectionDate, intervalMonths), mode: "reset", windowStart };
}

/**
 * The next gas-safety due date. Preserves the anniversary for in-window
 * renewals; otherwise re-anchors to the inspection date.
 */
export function nextGasDue(
  inspectionDate: string,
  anniversary: string,
  options: GasDueOptions = {},
): string {
  return gasDueDetail(inspectionDate, anniversary, options).dueDate;
}

export interface RecordGasInspectionInput {
  id: string;
  /** Date this inspection was performed (ISO date). */
  inspectionDate: string;
  /** The most recent prior gas evidence, if any (drives the anchor). */
  prior?: Pick<Evidence, "performedOn" | "anniversary">;
  options?: GasDueOptions;
}

/**
 * Build the gas evidence record to persist for a new inspection. The stored
 * `anniversary` is the anchor this inspection renews:
 *   - first ever inspection: the anniversary IS the inspection date;
 *   - a renewal: the due date computed from the prior record (which preserves
 *     the original anchor when renewals stay inside the grace window).
 *
 * Both `performedOn` (the inspection date) and `anniversary` are persisted, so
 * the anchor is auditable across the whole chain of renewals.
 */
export function recordGasInspection(input: RecordGasInspectionInput): Evidence {
  const anniversary =
    input.prior && input.prior.anniversary
      ? nextGasDue(input.prior.performedOn, input.prior.anniversary, input.options)
      : input.inspectionDate; // initial anchor

  return {
    id: input.id,
    type: "gas_safety",
    performedOn: input.inspectionDate,
    anniversary,
  };
}
