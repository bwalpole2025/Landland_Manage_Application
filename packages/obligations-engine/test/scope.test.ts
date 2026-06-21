import { describe, it, expect } from "vitest";
import { evaluate } from "../src/evaluate";
import { explainRentersRightsScope, RRA_MIN_ANNUAL_RENT_GBP, RRA_MAX_ANNUAL_RENT_GBP } from "../src/scope";
import { explainHmo } from "../src/predicates";
import { UK_RULES } from "../src/rules";
import { CITATIONS } from "../src/citations";
import type { ApplicabilityProfile, EvaluatedObligation, Evidence, Property } from "../src/types";

const ENGLAND: Property = { id: "p1", jurisdiction: "england", evidence: [] };

/** A fully in-scope, gas-supplied, single-let property. */
function inScopeProfile(over: Partial<ApplicabilityProfile> = {}): ApplicabilityProfile {
  return {
    propertyType: "house",
    hasGasSupply: true,
    occupants: 2,
    households: 1,
    selectiveLicensingArea: false,
    annualRentGBP: 12_000,
    tenantIsIndividual: true,
    tenantOnlyOrMainHome: true,
    landlordResident: false,
    ...over,
  };
}

function byId(obls: EvaluatedObligation[], ruleId: string): EvaluatedObligation {
  const found = obls.find((o) => o.ruleId === ruleId);
  if (!found) throw new Error(`no obligation for ${ruleId}`);
  return found;
}

describe("Renters' Rights Act in-scope test", () => {
  it("is in scope when all four conditions hold", () => {
    const e = explainRentersRightsScope(inScopeProfile());
    expect(e.inScope).toBe(true);
    expect(e.conditions.every((c) => c.pass)).toBe(true);
    expect(e.citation).toBe(CITATIONS.rraScope);
  });

  it("rent boundaries are inclusive", () => {
    expect(explainRentersRightsScope(inScopeProfile({ annualRentGBP: RRA_MIN_ANNUAL_RENT_GBP })).inScope).toBe(true);
    expect(explainRentersRightsScope(inScopeProfile({ annualRentGBP: RRA_MAX_ANNUAL_RENT_GBP })).inScope).toBe(true);
    expect(explainRentersRightsScope(inScopeProfile({ annualRentGBP: RRA_MIN_ANNUAL_RENT_GBP - 1 })).inScope).toBe(false);
    expect(explainRentersRightsScope(inScopeProfile({ annualRentGBP: RRA_MAX_ANNUAL_RENT_GBP + 1 })).inScope).toBe(false);
  });

  it("each failing condition is identified explicitly", () => {
    expect(explainRentersRightsScope(inScopeProfile({ tenantIsIndividual: false })).conditions.find((c) => c.id === "individual_tenant")!.pass).toBe(false);
    expect(explainRentersRightsScope(inScopeProfile({ tenantOnlyOrMainHome: false })).conditions.find((c) => c.id === "main_home")!.pass).toBe(false);
    expect(explainRentersRightsScope(inScopeProfile({ landlordResident: true })).conditions.find((c) => c.id === "non_resident_landlord")!.pass).toBe(false);
  });

  it("an empty profile is conservatively out of scope (not silently in)", () => {
    expect(explainRentersRightsScope({}).inScope).toBe(false);
  });
});

describe("scope gate — a property failing the in-scope test", () => {
  // The headline acceptance criterion: NOT empty, NOT green — all not_applicable.
  it("yields not_applicable obligations citing the RRA, never empty or compliant", () => {
    const outOfScope = inScopeProfile({ landlordResident: true }); // resident landlord -> out of scope
    const out = evaluate(ENGLAND, outOfScope, UK_RULES, "2025-01-01");

    // Not an empty list — every England/Wales rule still surfaces.
    expect(out.length).toBeGreaterThan(0);
    // Every obligation is not_applicable — none compliant/due_soon/overdue.
    expect(out.every((o) => o.status === "not_applicable")).toBe(true);
    expect(out.some((o) => o.status === "compliant")).toBe(false);
    // Each is explained as out-of-scope and cites the RRA.
    for (const o of out) {
      expect(o.dueDate).toBeNull();
      expect(o.basis.code).toBe("not_applicable");
      expect(o.basis.summary).toContain("Renters' Rights Act");
    }
  });

  it("stays not_applicable even when satisfying evidence exists (scope gates evidence)", () => {
    const gasCert: Evidence = { id: "g1", type: "gas_safety", performedOn: "2024-12-01", anniversary: "2024-12-01" };
    const property: Property = { ...ENGLAND, evidence: [gasCert] };
    const out = evaluate(property, inScopeProfile({ annualRentGBP: 120_000 }), UK_RULES, "2025-01-01");
    const gas = byId(out, "gas-safety");
    expect(gas.status).toBe("not_applicable"); // out of scope (rent too high) beats the valid cert
    expect(gas.evidenceIds).toEqual([]);
  });
});

describe("scope gate — an in-scope property evaluates real statuses", () => {
  it("applies the compliance rules and computes status from evidence + time", () => {
    const evidence: Evidence[] = [
      { id: "g1", type: "gas_safety", performedOn: "2024-12-01", anniversary: "2024-12-01" }, // due 2025-12-01
      { id: "e1", type: "eicr", performedOn: "2019-01-01" }, // due 2024-01-01 -> overdue
    ];
    const out = evaluate({ ...ENGLAND, evidence }, inScopeProfile(), UK_RULES, "2025-01-01");

    expect(byId(out, "gas-safety").status).toBe("compliant");
    expect(byId(out, "gas-safety").dueDate).toBe("2025-12-01");
    expect(byId(out, "eicr").status).toBe("overdue");
    expect(byId(out, "epc").status).toBe("overdue"); // applicable but no evidence
    expect(byId(out, "hmo-licence").status).toBe("not_applicable"); // single household
    expect(byId(out, "selective-licence").status).toBe("not_applicable"); // not in an area
  });

  it("HMO + selective licence become applicable when their tests pass", () => {
    const profile = inScopeProfile({ occupants: 5, households: 2, selectiveLicensingArea: true });
    const out = evaluate(ENGLAND, profile, UK_RULES, "2025-01-01");
    expect(byId(out, "hmo-licence").status).toBe("overdue"); // applicable, no licence evidence
    expect(byId(out, "selective-licence").status).toBe("overdue");
  });
});

describe("safety obligations & gas WHY", () => {
  it("includes a smoke & CO alarm obligation", () => {
    const out = evaluate(ENGLAND, inScopeProfile(), UK_RULES, "2025-01-01");
    const alarm = out.find((o) => o.ruleId === "smoke-co-alarm");
    expect(alarm).toBeTruthy();
    expect(alarm!.citation).toBe(CITATIONS.smokeCoAlarm);
    expect(alarm!.status).toBe("overdue"); // applicable, no evidence yet
  });

  it("gas basis explains the anniversary preservation in plain language", () => {
    // Inspected within the 2 months before the 2025-07-30 anniversary → preserved.
    const gasEvidence: Evidence = { id: "g1", type: "gas_safety", performedOn: "2025-06-15", anniversary: "2025-07-30" };
    const out = evaluate({ ...ENGLAND, evidence: [gasEvidence] }, inScopeProfile(), UK_RULES, "2025-08-01");
    const gas = byId(out, "gas-safety");
    expect(gas.dueDate).toBe("2026-07-30"); // anchor preserved
    expect(gas.basis.facts.anchorMode).toBe("preserved");
    expect(gas.basis.summary).toMatch(/grace window/);
    expect(gas.basis.summary).toContain("2025-07-30");
  });
});

describe('explicit "is this an HMO?" outcome', () => {
  it("is a licensable HMO at 5 occupants across 2 households, citing the rule", () => {
    const e = explainHmo(inScopeProfile({ occupants: 5, households: 2 }));
    expect(e.isHmo).toBe(true);
    expect(e.citation).toBe(CITATIONS.hmoLicence);
  });

  it("is not an HMO below the threshold", () => {
    expect(explainHmo(inScopeProfile({ occupants: 4, households: 2 })).isHmo).toBe(false);
    expect(explainHmo(inScopeProfile({ occupants: 5, households: 1 })).isHmo).toBe(false);
  });
});
