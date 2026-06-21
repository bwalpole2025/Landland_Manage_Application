// Rent arrears — derived from an expected payment schedule versus CONFIRMED,
// dated rent receipts. Pure and deterministic: the arrears state is computed
// from confirmed records only and is never inferred or summarised. No LLM.
//
// Supports the reformed Section 8 mandatory rent-arrears ground (Ground 8):
// at least 3 months' arrears (monthly rent) or 13 weeks' arrears (weekly rent),
// which must be met at BOTH the notice stage AND the hearing stage.

import { addDays, addMonths, compareISO } from "./dates";
import type { BasisCode, ObligationBasis, ObligationStatus } from "./types";

export type RentFrequency = "monthly" | "weekly";

export interface ScheduledPayment {
  dueDate: string; // ISO date
  amount: number;
}

/** A dated rent receipt. Only `confirmed` receipts count toward arrears. */
export interface RentReceipt {
  date: string; // ISO date
  amount: number;
  confirmed: boolean;
}

/** Ground-8 unit threshold: 3 months (monthly) or 13 weeks (weekly). */
export const GROUND8_MONTHS = 3;
export const GROUND8_WEEKS = 13;

export function ground8ThresholdUnits(frequency: RentFrequency): number {
  return frequency === "monthly" ? GROUND8_MONTHS : GROUND8_WEEKS;
}

export interface ScheduleParams {
  frequency: RentFrequency;
  rentAmount: number;
  startDate: string;
  /** Generate due dates up to and including this date. */
  until: string;
}

/** The expected payment schedule from `startDate` to `until`. */
export function generateRentSchedule(params: ScheduleParams): ScheduledPayment[] {
  const out: ScheduledPayment[] = [];
  let due = params.startDate;
  for (let i = 0; i < 1000 && compareISO(due, params.until) <= 0; i++) {
    out.push({ dueDate: due, amount: params.rentAmount });
    due = params.frequency === "monthly" ? addMonths(due, 1) : addDays(due, 7);
  }
  return out;
}

/** Arrears at a single point in time (notice / hearing / now). */
export interface StageAssessment {
  asOf: string;
  expected: number;
  received: number;
  /** expected − received (positive = owed, negative = in credit). */
  arrears: number;
  /** arrears expressed in rent units (e.g. 3.2 months). */
  arrearsInUnits: number;
  /** Whether the Ground-8 threshold is met at this stage. */
  thresholdMet: boolean;
}

export interface ArrearsAssessment {
  frequency: RentFrequency;
  rentAmount: number;
  unit: "months" | "weeks";
  thresholdUnits: number;
  /** thresholdUnits × rentAmount. */
  thresholdAmount: number;
  /** Arrears as of `asOf`. */
  current: StageAssessment;
  /** Arrears at the Section 8 notice stage (null if no notice date given). */
  notice: StageAssessment | null;
  /** Arrears at the hearing stage (null if no hearing date given). */
  hearing: StageAssessment | null;
  /** Ground 8 is available only when the threshold is met at BOTH stages. */
  ground8Available: boolean;
  status: ObligationStatus;
  basis: ObligationBasis;
}

export interface AssessArrearsInput {
  frequency: RentFrequency;
  rentAmount: number;
  startDate: string;
  /** Receipts ledger — only confirmed, dated receipts are counted. */
  receipts: RentReceipt[];
  asOf: string;
  noticeDate?: string;
  hearingDate?: string;
}

function latest(dates: string[]): string {
  return dates.reduce((a, b) => (compareISO(a, b) >= 0 ? a : b));
}

/** Assess rent arrears and the Section 8 Ground-8 threshold at each stage. */
export function assessArrears(input: AssessArrearsInput): ArrearsAssessment {
  const { frequency, rentAmount } = input;
  const unit = frequency === "monthly" ? "months" : "weeks";
  const thresholdUnits = ground8ThresholdUnits(frequency);
  const thresholdAmount = thresholdUnits * rentAmount;

  const stageDates = [input.asOf, input.noticeDate, input.hearingDate].filter((d): d is string => Boolean(d));
  const until = latest(stageDates);
  const schedule = generateRentSchedule({ frequency, rentAmount, startDate: input.startDate, until });

  // CLAIM SEPARATION: only confirmed receipts contribute.
  const confirmed = input.receipts.filter((r) => r.confirmed);

  const assess = (stageDate: string): StageAssessment => {
    const expected = schedule.filter((s) => compareISO(s.dueDate, stageDate) <= 0).reduce((sum, s) => sum + s.amount, 0);
    const received = confirmed.filter((r) => compareISO(r.date, stageDate) <= 0).reduce((sum, r) => sum + r.amount, 0);
    const arrears = expected - received;
    return {
      asOf: stageDate,
      expected,
      received,
      arrears,
      arrearsInUnits: rentAmount > 0 ? arrears / rentAmount : 0,
      thresholdMet: rentAmount > 0 && arrears >= thresholdAmount,
    };
  };

  const current = assess(input.asOf);
  const notice = input.noticeDate ? assess(input.noticeDate) : null;
  const hearing = input.hearingDate ? assess(input.hearingDate) : null;
  const ground8Available = Boolean(notice?.thresholdMet && hearing?.thresholdMet);

  // RAG severity of the CURRENT arrears (status only; figures are exact).
  let status: ObligationStatus;
  let code: BasisCode;
  if (rentAmount <= 0) {
    status = "not_applicable";
    code = "not_applicable";
  } else if (current.arrears <= 0) {
    status = "compliant";
    code = "compliant";
  } else if (current.arrears < thresholdAmount) {
    status = "due_soon";
    code = "due_soon";
  } else {
    status = "overdue";
    code = "overdue";
  }

  const summary =
    rentAmount <= 0
      ? "No rent schedule set."
      : current.arrears <= 0
        ? `Up to date (${current.arrears === 0 ? "no arrears" : `£${Math.abs(current.arrears)} in credit`}).`
        : `Arrears of £${current.arrears} = ${current.arrearsInUnits.toFixed(1)} ${unit}' rent. Section 8 Ground 8 threshold is ${thresholdUnits} ${unit} (£${thresholdAmount}); ${current.thresholdMet ? "MET" : "not met"} at the current date.`;

  return {
    frequency,
    rentAmount,
    unit,
    thresholdUnits,
    thresholdAmount,
    current,
    notice,
    hearing,
    ground8Available,
    status,
    basis: {
      code,
      summary,
      facts: {
        arrears: current.arrears,
        expected: current.expected,
        received: current.received,
        thresholdAmount,
        thresholdUnits,
        thresholdMet: current.thresholdMet,
        noticeThresholdMet: notice?.thresholdMet ?? null,
        hearingThresholdMet: hearing?.thresholdMet ?? null,
        ground8Available,
      },
    },
  };
}
