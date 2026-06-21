import { describe, it, expect } from "vitest";
import { evaluate } from "../src/evaluate";
import { alwaysApplies, requiresGasSupply, requiresHmoLicence } from "../src/predicates";
import type { EvaluatedObligation, Evidence, Property, Rule } from "../src/types";

// --- Rule fixtures ----------------------------------------------------------

const gasRule: Rule = {
  id: "gas-safety",
  citation: "Gas Safety (Installation and Use) Regulations 1998, reg 36(3)",
  title: "Annual gas safety check",
  jurisdictions: ["england", "wales"],
  effectiveFrom: "1998-10-31",
  effectiveTo: null,
  evidenceType: "gas_safety",
  cadence: { intervalMonths: 12, anniversaryPreservation: true, graceMonths: 2 },
  applicability: requiresGasSupply,
  warningDays: 60,
};

const eicrRule: Rule = {
  id: "eicr",
  citation: "Electrical Safety Standards in the Private Rented Sector (England) Regulations 2020",
  title: "Electrical installation condition report (EICR)",
  jurisdictions: ["england"],
  effectiveFrom: "2020-06-01",
  effectiveTo: null,
  evidenceType: "eicr",
  cadence: { intervalMonths: 60 }, // 5-yearly
  applicability: alwaysApplies,
};

const epcRule: Rule = {
  id: "epc",
  citation: "Energy Performance of Buildings (England and Wales) Regulations 2012",
  title: "Energy Performance Certificate (EPC)",
  jurisdictions: ["england", "wales"],
  effectiveFrom: "2008-10-01",
  effectiveTo: null,
  evidenceType: "epc",
  cadence: { intervalMonths: 120 }, // 10-yearly
  applicability: alwaysApplies,
};

const hmoRule: Rule = {
  id: "hmo-licence",
  citation: "Housing Act 2004, Part 2 (mandatory HMO licensing)",
  title: "Mandatory HMO licence",
  jurisdictions: ["england"],
  effectiveFrom: "2006-04-06",
  effectiveTo: null,
  evidenceType: "hmo_licence",
  cadence: { intervalMonths: 60 },
  applicability: requiresHmoLicence,
};

const ALL_RULES = [gasRule, eicrRule, epcRule, hmoRule];

function property(over: Partial<Property> = {}): Property {
  return { id: "p1", jurisdiction: "england", evidence: [], ...over };
}

function pick(obls: EvaluatedObligation[], ruleId: string): EvaluatedObligation {
  const found = obls.find((o) => o.ruleId === ruleId);
  if (!found) throw new Error(`no obligation for rule ${ruleId}`);
  return found;
}

// --- Step 1: SELECT ---------------------------------------------------------

describe("evaluate — SELECT (jurisdiction + effective window)", () => {
  it("excludes rules whose jurisdiction does not match the property", () => {
    const out = evaluate(property({ jurisdiction: "scotland" }), { hasGasSupply: true }, ALL_RULES, "2025-01-01");
    expect(out).toHaveLength(0); // none of these rules cover Scotland
  });

  it("includes a rule only when asOf is within [effectiveFrom, effectiveTo]", () => {
    const timeBoxed: Rule = { ...eicrRule, id: "eicr-old", effectiveFrom: "2020-06-01", effectiveTo: "2022-12-31" };
    expect(evaluate(property(), {}, [timeBoxed], "2021-06-01")).toHaveLength(1); // inside window
    expect(evaluate(property(), {}, [timeBoxed], "2025-06-01")).toHaveLength(0); // after effectiveTo
    expect(evaluate(property(), {}, [timeBoxed], "2019-06-01")).toHaveLength(0); // before effectiveFrom
  });

  it("treats effectiveTo = null as still in force", () => {
    expect(evaluate(property(), {}, [eicrRule], "2099-01-01")).toHaveLength(1);
  });

  it("preserves input rule order among selected rules", () => {
    const out = evaluate(property(), { hasGasSupply: true, occupants: 5, households: 2 }, ALL_RULES, "2025-01-01");
    expect(out.map((o) => o.ruleId)).toEqual(["gas-safety", "eicr", "epc", "hmo-licence"]);
  });
});

// --- Step 2: FILTER (applicability) ----------------------------------------

describe("evaluate — FILTER (applicability is never a misleading 'compliant')", () => {
  it("gas rule with no gas supply is not_applicable, not compliant", () => {
    const out = evaluate(property(), { hasGasSupply: false }, [gasRule], "2025-01-01");
    const gas = pick(out, "gas-safety");
    expect(gas.status).toBe("not_applicable");
    expect(gas.status).not.toBe("compliant");
    expect(gas.dueDate).toBeNull();
    expect(gas.evidenceIds).toEqual([]);
    expect(gas.basis.code).toBe("not_applicable");
    expect(gas.basis.summary).toMatch(/no gas supply/i);
  });

  it("HMO rule applies only when the HMO test passes (5+ occupants, 2+ households)", () => {
    const applies = evaluate(property(), { occupants: 5, households: 2 }, [hmoRule], "2025-01-01");
    expect(pick(applies, "hmo-licence").status).not.toBe("not_applicable");

    const fails = evaluate(property(), { occupants: 4, households: 2 }, [hmoRule], "2025-01-01");
    const obl = pick(fails, "hmo-licence");
    expect(obl.status).toBe("not_applicable");
    expect(obl.basis.summary).toMatch(/not a licensable hmo/i);
  });
});

// --- Step 3: COMPUTE (status from evidence + time only) --------------------

describe("evaluate — COMPUTE: gas with anniversary preservation", () => {
  // Gas evidence: renewed in-window, so the due date keeps the 10 March anchor.
  const gasEvidence: Evidence = { id: "g2", type: "gas_safety", performedOn: "2024-02-20", anniversary: "2024-03-10" };
  const withGas = property({ evidence: [gasEvidence] });

  it("is compliant well before the preserved due date", () => {
    const gas = pick(evaluate(withGas, { hasGasSupply: true }, [gasRule], "2024-06-01"), "gas-safety");
    expect(gas.status).toBe("compliant");
    expect(gas.dueDate).toBe("2025-03-10"); // preserved anniversary, not 2025-02-20
    expect(gas.evidenceIds).toEqual(["g2"]);
    expect(gas.basis.facts).toMatchObject({
      anchorMode: "preserved",
      anniversary: "2024-03-10",
      inspectionDate: "2024-02-20",
      dueDate: "2025-03-10",
    });
  });

  it("is due_soon inside the 60-day warning window", () => {
    const gas = pick(evaluate(withGas, { hasGasSupply: true }, [gasRule], "2025-02-01"), "gas-safety");
    expect(gas.status).toBe("due_soon"); // 37 days to 2025-03-10
    expect(gas.basis.code).toBe("due_soon");
  });

  it("is overdue after the due date", () => {
    const gas = pick(evaluate(withGas, { hasGasSupply: true }, [gasRule], "2025-04-01"), "gas-safety");
    expect(gas.status).toBe("overdue");
    expect(gas.basis.summary).toMatch(/expired on 2025-03-10/);
  });

  it("warning-window boundaries: 60 days = due_soon, 61 days = compliant, due day = due_soon", () => {
    const due = "2025-03-10";
    const at60 = pick(evaluate(withGas, { hasGasSupply: true }, [gasRule], "2025-01-09"), "gas-safety");
    expect(at60.basis.facts.daysUntilDue).toBe(60);
    expect(at60.status).toBe("due_soon");
    const at61 = pick(evaluate(withGas, { hasGasSupply: true }, [gasRule], "2025-01-08"), "gas-safety");
    expect(at61.basis.facts.daysUntilDue).toBe(61);
    expect(at61.status).toBe("compliant");
    const onDue = pick(evaluate(withGas, { hasGasSupply: true }, [gasRule], due), "gas-safety");
    expect(onDue.status).toBe("due_soon"); // 0 days
  });

  it("a CONFIRMED expiry on the certificate is authoritative — it overrides the anniversary path", () => {
    // Same inspection, but a confirmed expiry is present: the engine reads it.
    const confirmed: Evidence = { id: "g3", type: "gas_safety", performedOn: "2024-02-20", anniversary: "2024-03-10", expiresOn: "2025-05-01" };
    const gas = pick(evaluate(property({ evidence: [confirmed] }), { hasGasSupply: true }, [gasRule], "2024-06-01"), "gas-safety");
    expect(gas.dueDate).toBe("2025-05-01"); // confirmed expiry, not the 2025-03-10 anniversary
    expect(gas.basis.facts.source).toBe("confirmed_expiry");
  });

  it("applicable rule with NO evidence is overdue (never silently compliant)", () => {
    const gas = pick(evaluate(property(), { hasGasSupply: true }, [gasRule], "2025-01-01"), "gas-safety");
    expect(gas.status).toBe("overdue");
    expect(gas.dueDate).toBeNull();
    expect(gas.basis.code).toBe("no_evidence");
  });

  it("uses the NEWEST evidence and lists all considered evidence newest-first", () => {
    const older: Evidence = { id: "g1", type: "gas_safety", performedOn: "2023-03-05", anniversary: "2023-03-10" };
    const newer: Evidence = { id: "g2", type: "gas_safety", performedOn: "2024-02-20", anniversary: "2024-03-10" };
    const gas = pick(
      evaluate(property({ evidence: [older, newer] }), { hasGasSupply: true }, [gasRule], "2024-06-01"),
      "gas-safety",
    );
    expect(gas.dueDate).toBe("2025-03-10"); // driven by the newer inspection
    expect(gas.evidenceIds).toEqual(["g2", "g1"]);
  });
});

describe("evaluate — COMPUTE: EICR (5-yearly) cadence", () => {
  const evidence: Evidence = { id: "e1", type: "eicr", performedOn: "2021-06-01" };
  const withEicr = property({ evidence: [evidence] });

  it("due date is the inspection + 60 months", () => {
    const eicr = pick(evaluate(withEicr, {}, [eicrRule], "2024-06-01"), "eicr");
    expect(eicr.dueDate).toBe("2026-06-01");
    expect(eicr.status).toBe("compliant");
  });

  it("transitions compliant → due_soon → overdue across the cadence", () => {
    expect(pick(evaluate(withEicr, {}, [eicrRule], "2026-05-01"), "eicr").status).toBe("due_soon");
    expect(pick(evaluate(withEicr, {}, [eicrRule], "2026-07-01"), "eicr").status).toBe("overdue");
  });

  it("spans leap years correctly (5-yearly from a 29 Feb inspection)", () => {
    const leap = property({ evidence: [{ id: "e2", type: "eicr", performedOn: "2024-02-29" }] });
    const eicr = pick(evaluate(leap, {}, [eicrRule], "2025-01-01"), "eicr");
    expect(eicr.dueDate).toBe("2029-02-28"); // +60 months, clamped (2029 common year)
  });
});

describe("evaluate — COMPUTE: EPC cadence", () => {
  it("derives a 10-year due date from the issue date", () => {
    const withEpc = property({ evidence: [{ id: "p1", type: "epc", performedOn: "2016-01-01" }] });
    expect(pick(evaluate(withEpc, {}, [epcRule], "2024-01-01"), "epc").status).toBe("compliant");
    expect(pick(evaluate(withEpc, {}, [epcRule], "2024-01-01"), "epc").dueDate).toBe("2026-01-01");
    expect(pick(evaluate(withEpc, {}, [epcRule], "2025-12-15"), "epc").status).toBe("due_soon");
    expect(pick(evaluate(withEpc, {}, [epcRule], "2026-02-01"), "epc").status).toBe("overdue");
  });

  it("honours an explicit expiresOn over the derived cadence date", () => {
    const withEpc = property({ evidence: [{ id: "p2", type: "epc", performedOn: "2016-01-01", expiresOn: "2030-01-01" }] });
    const epc = pick(evaluate(withEpc, {}, [epcRule], "2026-06-01"), "epc");
    expect(epc.dueDate).toBe("2030-01-01");
    expect(epc.status).toBe("compliant");
  });
});

// --- Claim separation -------------------------------------------------------

describe("evaluate — is the sole origin of status, dueDate and citation", () => {
  it("passes the rule's citation through unchanged and emits a structured basis", () => {
    const out = evaluate(
      property({ evidence: [{ id: "g2", type: "gas_safety", performedOn: "2024-02-20", anniversary: "2024-03-10" }] }),
      { hasGasSupply: true },
      [gasRule],
      "2024-06-01",
    );
    const gas = pick(out, "gas-safety");
    expect(gas.citation).toBe(gasRule.citation);
    expect(gas.title).toBe(gasRule.title);
    expect(gas.basis).toMatchObject({ code: "compliant" });
    expect(typeof gas.basis.summary).toBe("string");
    expect(gas.basis.summary.length).toBeGreaterThan(0);
  });

  it("evaluates a whole property to a deterministic, status-correct set", () => {
    const evidence: Evidence[] = [
      { id: "g2", type: "gas_safety", performedOn: "2024-02-20", anniversary: "2024-03-10" }, // compliant
      { id: "e1", type: "eicr", performedOn: "2019-01-01" }, // overdue (due 2024-01-01)
      // no EPC evidence → overdue; HMO not applicable (single household)
    ];
    const out = evaluate(
      property({ evidence }),
      { hasGasSupply: true, occupants: 2, households: 1 },
      ALL_RULES,
      "2024-06-01",
    );
    expect(pick(out, "gas-safety").status).toBe("compliant");
    expect(pick(out, "eicr").status).toBe("overdue");
    expect(pick(out, "epc").status).toBe("overdue"); // no evidence
    expect(pick(out, "hmo-licence").status).toBe("not_applicable");
  });
});
