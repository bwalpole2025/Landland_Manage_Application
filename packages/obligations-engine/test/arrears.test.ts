import { describe, it, expect } from "vitest";
import { assessArrears, generateRentSchedule, type RentReceipt } from "../src/index";

// Monthly rent £1,000 from 2026-01-01. Due dates: 01-01, 02-01, 03-01, 04-01, …
const MONTHLY = { frequency: "monthly" as const, rentAmount: 1000, startDate: "2026-01-01" };
// Weekly rent £200 from 2026-01-01. Due every 7 days: 01-01, 01-08, …
const WEEKLY = { frequency: "weekly" as const, rentAmount: 200, startDate: "2026-01-01" };

const noReceipts: RentReceipt[] = [];

describe("generateRentSchedule", () => {
  it("monthly due dates step by calendar month", () => {
    const s = generateRentSchedule({ ...MONTHLY, until: "2026-03-15" });
    expect(s.map((p) => p.dueDate)).toEqual(["2026-01-01", "2026-02-01", "2026-03-01"]);
    expect(s.every((p) => p.amount === 1000)).toBe(true);
  });
  it("weekly due dates step by 7 days", () => {
    const s = generateRentSchedule({ ...WEEKLY, until: "2026-01-22" });
    expect(s.map((p) => p.dueDate)).toEqual(["2026-01-01", "2026-01-08", "2026-01-15", "2026-01-22"]);
  });
});

describe("Section 8 Ground 8 — 3-month threshold (monthly), boundaries", () => {
  it("exactly 3 months' arrears MEETS the threshold (inclusive boundary)", () => {
    // By 2026-03-01: Jan+Feb+Mar due = £3,000; nothing paid → arrears £3,000 = threshold.
    const a = assessArrears({ ...MONTHLY, receipts: noReceipts, asOf: "2026-03-01" });
    expect(a.thresholdAmount).toBe(3000);
    expect(a.current.arrears).toBe(3000);
    expect(a.current.thresholdMet).toBe(true);
    expect(a.status).toBe("overdue");
  });

  it("just below 3 months does NOT meet the threshold", () => {
    // £1 paid → arrears £2,999 < £3,000.
    const receipts: RentReceipt[] = [{ date: "2026-03-01", amount: 1, confirmed: true }];
    const a = assessArrears({ ...MONTHLY, receipts, asOf: "2026-03-01" });
    expect(a.current.arrears).toBe(2999);
    expect(a.current.thresholdMet).toBe(false);
    expect(a.status).toBe("due_soon");
  });

  it("more than 3 months meets the threshold", () => {
    const a = assessArrears({ ...MONTHLY, receipts: noReceipts, asOf: "2026-04-01" }); // £4,000
    expect(a.current.arrears).toBe(4000);
    expect(a.current.thresholdMet).toBe(true);
  });

  it("up to date → compliant, no arrears", () => {
    const receipts: RentReceipt[] = [
      { date: "2026-01-01", amount: 1000, confirmed: true },
      { date: "2026-02-01", amount: 1000, confirmed: true },
      { date: "2026-03-01", amount: 1000, confirmed: true },
    ];
    const a = assessArrears({ ...MONTHLY, receipts, asOf: "2026-03-01" });
    expect(a.current.arrears).toBe(0);
    expect(a.status).toBe("compliant");
    expect(a.current.thresholdMet).toBe(false);
  });
});

describe("Section 8 Ground 8 — 13-week threshold (weekly), boundaries", () => {
  it("exactly 13 weeks' arrears MEETS the threshold", () => {
    // 13 payments due by 2026-03-26 (start + 12×7) = £2,600 = threshold.
    const a = assessArrears({ ...WEEKLY, receipts: noReceipts, asOf: "2026-03-26" });
    expect(a.thresholdUnits).toBe(13);
    expect(a.thresholdAmount).toBe(2600);
    expect(a.current.arrears).toBe(2600);
    expect(a.current.thresholdMet).toBe(true);
  });

  it("12 weeks (one short) does NOT meet the threshold", () => {
    // By 2026-03-25 only 12 payments are due (last on 2026-03-19) = £2,400.
    const a = assessArrears({ ...WEEKLY, receipts: noReceipts, asOf: "2026-03-25" });
    expect(a.current.arrears).toBe(2400);
    expect(a.current.thresholdMet).toBe(false);
  });

  it("13 weeks due but £1 paid does NOT meet the threshold", () => {
    const receipts: RentReceipt[] = [{ date: "2026-03-26", amount: 1, confirmed: true }];
    const a = assessArrears({ ...WEEKLY, receipts, asOf: "2026-03-26" });
    expect(a.current.arrears).toBe(2599);
    expect(a.current.thresholdMet).toBe(false);
  });
});

describe("threshold met at BOTH notice and hearing stages", () => {
  it("met at notice AND hearing → Ground 8 available", () => {
    const a = assessArrears({ ...MONTHLY, receipts: noReceipts, asOf: "2026-04-01", noticeDate: "2026-03-01", hearingDate: "2026-04-01" });
    expect(a.notice!.thresholdMet).toBe(true); // £3,000 at notice
    expect(a.hearing!.thresholdMet).toBe(true); // £4,000 at hearing
    expect(a.ground8Available).toBe(true);
  });

  it("met at notice but a payment drops it below by the hearing → NOT available", () => {
    // Notice 2026-03-01: £3,000 (met). Tenant pays £1,500 on 03-15.
    // Hearing 2026-04-01: expected £4,000 − £1,500 = £2,500 (< £3,000, not met).
    const receipts: RentReceipt[] = [{ date: "2026-03-15", amount: 1500, confirmed: true }];
    const a = assessArrears({ ...MONTHLY, receipts, asOf: "2026-04-01", noticeDate: "2026-03-01", hearingDate: "2026-04-01" });
    expect(a.notice!.thresholdMet).toBe(true);
    expect(a.hearing!.thresholdMet).toBe(false);
    expect(a.ground8Available).toBe(false);
  });

  it("below threshold at notice (even if met later) → NOT available", () => {
    // Notice early (2026-02-01): only £2,000 due (< £3,000). Hearing 2026-04-01: £4,000 (met).
    const a = assessArrears({ ...MONTHLY, receipts: noReceipts, asOf: "2026-04-01", noticeDate: "2026-02-01", hearingDate: "2026-04-01" });
    expect(a.notice!.thresholdMet).toBe(false);
    expect(a.hearing!.thresholdMet).toBe(true);
    expect(a.ground8Available).toBe(false);
  });

  it("weekly: met at both 13-week stages → available", () => {
    const a = assessArrears({ ...WEEKLY, receipts: noReceipts, asOf: "2026-04-09", noticeDate: "2026-03-26", hearingDate: "2026-04-09" });
    expect(a.notice!.thresholdMet).toBe(true);
    expect(a.hearing!.thresholdMet).toBe(true);
    expect(a.ground8Available).toBe(true);
  });
});

describe("CLAIM SEPARATION — only confirmed receipts count", () => {
  it("an unconfirmed receipt does NOT reduce arrears", () => {
    const receipts: RentReceipt[] = [{ date: "2026-02-01", amount: 3000, confirmed: false }];
    const a = assessArrears({ ...MONTHLY, receipts, asOf: "2026-03-01" });
    // The £3,000 unconfirmed payment is ignored → arrears still £3,000.
    expect(a.current.received).toBe(0);
    expect(a.current.arrears).toBe(3000);
    expect(a.current.thresholdMet).toBe(true);
  });

  it("confirming the same receipt clears the arrears", () => {
    const receipts: RentReceipt[] = [{ date: "2026-02-01", amount: 3000, confirmed: true }];
    const a = assessArrears({ ...MONTHLY, receipts, asOf: "2026-03-01" });
    expect(a.current.received).toBe(3000);
    expect(a.current.arrears).toBe(0);
    expect(a.current.thresholdMet).toBe(false);
  });
});
