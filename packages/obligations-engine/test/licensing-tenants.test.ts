import { describe, it, expect } from "vitest";
import { evaluate } from "../src/evaluate";
import { UK_RULES } from "../src/rules";
import type { ApplicabilityProfile, EvaluatedObligation, Evidence, Property } from "../src/types";

const ENGLAND: Pick<Property, "id" | "jurisdiction"> = { id: "p1", jurisdiction: "england" };
const IN_SCOPE: ApplicabilityProfile = {
  annualRentGBP: 12_000,
  tenantIsIndividual: true,
  tenantOnlyOrMainHome: true,
  landlordResident: false,
};
const ASOF = "2026-06-20";

function byId(out: EvaluatedObligation[], id: string): EvaluatedObligation {
  const o = out.find((x) => x.ruleId === id);
  if (!o) throw new Error(`no obligation ${id}`);
  return o;
}

describe("Licensing — licence-expiry obligations", () => {
  it("a LAPSED HMO licence resolves to overdue", () => {
    // HMO test passes (5 occupants / 2 households); licence (evidence) expired in the past.
    const profile: ApplicabilityProfile = { ...IN_SCOPE, occupants: 5, households: 2 };
    const lapsed: Evidence = { id: "lic1", type: "hmo_licence", performedOn: "2021-01-01", expiresOn: "2026-01-01" };
    const out = evaluate({ ...ENGLAND, evidence: [lapsed] }, profile, UK_RULES, ASOF);
    const licence = byId(out, "hmo-licence");
    expect(licence.status).toBe("overdue"); // expired 2026-01-01, asOf 2026-06-20
    expect(licence.dueDate).toBe("2026-01-01");
  });

  it("a current HMO licence is compliant; expiring soon is due_soon", () => {
    const profile: ApplicabilityProfile = { ...IN_SCOPE, occupants: 5, households: 2 };
    const current: Evidence = { id: "lic2", type: "hmo_licence", performedOn: "2024-01-01", expiresOn: "2027-01-01" };
    expect(byId(evaluate({ ...ENGLAND, evidence: [current] }, profile, UK_RULES, ASOF), "hmo-licence").status).toBe("compliant");
    const soon: Evidence = { id: "lic3", type: "hmo_licence", performedOn: "2024-08-01", expiresOn: "2026-07-15" };
    expect(byId(evaluate({ ...ENGLAND, evidence: [soon] }, profile, UK_RULES, ASOF), "hmo-licence").status).toBe("due_soon");
  });

  it("additional-licence applies only inside a designated area", () => {
    const notArea = evaluate(ENGLAND, IN_SCOPE, UK_RULES, ASOF);
    expect(byId(notArea, "additional-licence").status).toBe("not_applicable");
    const inArea = evaluate(ENGLAND, { ...IN_SCOPE, additionalLicensingArea: true }, UK_RULES, ASOF);
    expect(byId(inArea, "additional-licence").status).toBe("overdue"); // applies, no licence on record
  });
});

describe("Tenants — Right to Rent re-check obligation", () => {
  it("is not_applicable when there are no tenants", () => {
    const out = evaluate(ENGLAND, IN_SCOPE, UK_RULES, ASOF);
    expect(byId(out, "right-to-rent").status).toBe("not_applicable");
  });

  it("is overdue when a tenant has no completed check", () => {
    const out = evaluate({ ...ENGLAND, rightToRent: { hasTenants: true, checksComplete: false } }, IN_SCOPE, UK_RULES, ASOF);
    expect(byId(out, "right-to-rent").status).toBe("overdue");
  });

  it("is compliant when all checked and no re-check due", () => {
    const out = evaluate({ ...ENGLAND, rightToRent: { hasTenants: true, checksComplete: true, recheckDue: null } }, IN_SCOPE, UK_RULES, ASOF);
    expect(byId(out, "right-to-rent").status).toBe("compliant");
  });

  it("re-check date drives due_soon / overdue", () => {
    const overdue = evaluate({ ...ENGLAND, rightToRent: { hasTenants: true, checksComplete: true, recheckDue: "2026-01-01" } }, IN_SCOPE, UK_RULES, ASOF);
    expect(byId(overdue, "right-to-rent").status).toBe("overdue");
    const soon = evaluate({ ...ENGLAND, rightToRent: { hasTenants: true, checksComplete: true, recheckDue: "2026-07-10" } }, IN_SCOPE, UK_RULES, ASOF);
    expect(byId(soon, "right-to-rent").status).toBe("due_soon");
    const future = evaluate({ ...ENGLAND, rightToRent: { hasTenants: true, checksComplete: true, recheckDue: "2027-01-01" } }, IN_SCOPE, UK_RULES, ASOF);
    expect(byId(future, "right-to-rent").status).toBe("compliant");
  });
});
