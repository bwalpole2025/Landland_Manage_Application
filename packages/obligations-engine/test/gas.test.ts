import { describe, it, expect } from "vitest";
import { addMonths, daysBetween } from "../src/dates";
import { nextGasDue, gasDueDetail, recordGasInspection } from "../src/gas";

describe("date helpers", () => {
  it("addMonths clamps the day to the end of the target month (leap-year safe)", () => {
    expect(addMonths("2024-02-29", 12)).toBe("2025-02-28"); // no 29th in 2025
    expect(addMonths("2024-01-31", 1)).toBe("2024-02-29"); // Feb in a leap year
    expect(addMonths("2025-01-31", 1)).toBe("2025-02-28"); // Feb in a common year
    expect(addMonths("2025-03-15", -2)).toBe("2025-01-15");
    expect(addMonths("2025-04-30", -2)).toBe("2025-02-28"); // clamp on subtraction
    expect(addMonths("2024-04-30", -2)).toBe("2024-02-29"); // clamp, leap year
  });

  it("addMonths rolls years correctly in both directions", () => {
    expect(addMonths("2025-11-15", 3)).toBe("2026-02-15");
    expect(addMonths("2025-02-15", -3)).toBe("2024-11-15");
  });

  it("daysBetween counts whole days and is signed", () => {
    expect(daysBetween("2025-01-01", "2025-01-31")).toBe(30);
    expect(daysBetween("2025-03-01", "2025-02-28")).toBe(-1);
    expect(daysBetween("2024-02-28", "2024-03-01")).toBe(2); // 2024 leap → 29th exists
    expect(daysBetween("2025-02-28", "2025-03-01")).toBe(1); // 2025 common
  });
});

describe("nextGasDue — anniversary preservation", () => {
  const anniversary = "2025-03-15";
  // graceMonths default 2 → window is [2025-01-15, 2025-03-15] inclusive.

  it("PRESERVES the anniversary for an inspection just inside the window (window start)", () => {
    const d = gasDueDetail("2025-01-15", anniversary);
    expect(d.windowStart).toBe("2025-01-15");
    expect(d.mode).toBe("preserved");
    expect(d.dueDate).toBe("2026-03-15"); // anniversary + 12m, NOT inspection + 12m
    expect(nextGasDue("2025-01-15", anniversary)).toBe("2026-03-15");
  });

  it("PRESERVES for an inspection on the anniversary itself", () => {
    const d = gasDueDetail("2025-03-15", anniversary);
    expect(d.mode).toBe("preserved");
    expect(d.dueDate).toBe("2026-03-15");
  });

  it("PRESERVES for an inspection mid-window", () => {
    expect(nextGasDue("2025-02-01", anniversary)).toBe("2026-03-15");
  });

  it("RESETS for an inspection just OUTSIDE the window (one day before window start)", () => {
    const d = gasDueDetail("2025-01-14", anniversary);
    expect(d.mode).toBe("reset");
    expect(d.dueDate).toBe("2026-01-14"); // inspection + 12m
  });

  it("RESETS for a much-earlier inspection", () => {
    expect(nextGasDue("2024-11-01", anniversary)).toBe("2025-11-01");
  });

  it("RE-ANCHORS for a LATE inspection (one day after the anniversary)", () => {
    const d = gasDueDetail("2025-03-16", anniversary);
    expect(d.mode).toBe("late");
    expect(d.dueDate).toBe("2026-03-16"); // inspection + 12m
  });

  it("RE-ANCHORS for a very late inspection", () => {
    expect(nextGasDue("2025-06-20", anniversary)).toBe("2026-06-20");
  });
});

describe("nextGasDue — leap-year boundaries", () => {
  it("preserves a 29 Feb anniversary onto 28 Feb the following (common) year", () => {
    // anniversary 2024-02-29 → window [2023-12-29, 2024-02-29].
    expect(gasDueDetail("2024-02-10", "2024-02-29").mode).toBe("preserved");
    expect(nextGasDue("2024-02-10", "2024-02-29")).toBe("2025-02-28");
  });

  it("resets a 29 Feb inspection with day-clamping on +12 months", () => {
    // Inspection well before the window → reset to inspection + 12m, clamped.
    expect(nextGasDue("2024-02-29", "2025-06-01")).toBe("2025-02-28");
  });

  it("computes the grace window with clamping when the anniversary is 30/31", () => {
    // anniversary 2025-04-30 → window start clamps to 2025-02-28.
    expect(gasDueDetail("2025-02-28", "2025-04-30").mode).toBe("preserved");
    expect(gasDueDetail("2025-02-27", "2025-04-30").mode).toBe("reset");
  });
});

describe("recordGasInspection — auditable anchor chain", () => {
  it("first inspection anchors the anniversary to the inspection date", () => {
    const g1 = recordGasInspection({ id: "g1", inspectionDate: "2023-03-10" });
    expect(g1).toMatchObject({ id: "g1", type: "gas_safety", performedOn: "2023-03-10", anniversary: "2023-03-10" });
    // Next due is inspection + 12m.
    expect(nextGasDue(g1.performedOn, g1.anniversary!)).toBe("2024-03-10");
  });

  it("an in-window renewal PRESERVES the original anniversary across the chain", () => {
    const g1 = recordGasInspection({ id: "g1", inspectionDate: "2023-03-10" });
    const g2 = recordGasInspection({ id: "g2", inspectionDate: "2024-02-20", prior: g1 });

    // Both the inspection date AND the anchor it renews are persisted.
    expect(g2.performedOn).toBe("2024-02-20");
    expect(g2.anniversary).toBe("2024-03-10"); // the cycle this inspection renews
    // The next due keeps the 10 March anchor → no drift.
    expect(nextGasDue(g2.performedOn, g2.anniversary!)).toBe("2025-03-10");
    expect(gasDueDetail(g2.performedOn, g2.anniversary!).mode).toBe("preserved");
  });

  it("an early renewal RESETS the anchor while still recording the original anniversary", () => {
    const g1 = recordGasInspection({ id: "g1", inspectionDate: "2023-03-10" });
    // 2024-01-05 is before the window start (2024-01-10) of the 2024-03-10 anchor.
    const g2 = recordGasInspection({ id: "g2", inspectionDate: "2024-01-05", prior: g1 });
    expect(g2.anniversary).toBe("2024-03-10"); // anchor preserved on the record (auditable)
    expect(gasDueDetail(g2.performedOn, g2.anniversary!).mode).toBe("reset");
    expect(nextGasDue(g2.performedOn, g2.anniversary!)).toBe("2025-01-05"); // re-anchored
  });
});
