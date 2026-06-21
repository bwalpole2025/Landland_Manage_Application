import { describe, it, expect } from "vitest";
import { evaluate } from "../src/evaluate";
import { UK_RULES } from "../src/rules";
import type { ApplicabilityProfile, EvaluatedObligation, Property } from "../src/types";

const ENGLAND: Pick<Property, "id" | "jurisdiction"> = { id: "p1", jurisdiction: "england" };
const IN_SCOPE: ApplicabilityProfile = {
  hasGasSupply: false,
  annualRentGBP: 12_000,
  tenantIsIndividual: true,
  tenantOnlyOrMainHome: true,
  landlordResident: false,
};
const ASOF = "2026-06-20";

function ev(property: Property, profile: ApplicabilityProfile = IN_SCOPE): EvaluatedObligation[] {
  return evaluate(property, profile, UK_RULES, ASOF);
}
function byId(out: EvaluatedObligation[], id: string): EvaluatedObligation {
  const o = out.find((x) => x.ruleId === id);
  if (!o) throw new Error(`no obligation ${id}`);
  return o;
}

describe("deposit obligations (deadline checks; block possession)", () => {
  // The headline acceptance criterion.
  it("an unprotected deposit and missing prescribed information each resolve to non-compliant", () => {
    const out = ev({ ...ENGLAND, deposit: { receivedOn: "2026-01-01" } }); // not protected, no PI served

    const protection = byId(out, "deposit-protection");
    expect(protection.status).toBe("overdue");
    expect(protection.status).not.toBe("compliant");
    expect(protection.blocksPossession).toBe(true);
    expect(protection.dueDate).toBe("2026-01-31"); // received + 30 days

    const prescribed = byId(out, "deposit-prescribed-information");
    expect(prescribed.status).toBe("overdue");
    expect(prescribed.blocksPossession).toBe(true);
    expect(prescribed.dueDate).toBe("2026-01-31");
  });

  it("protected and prescribed information served within 30 days → compliant", () => {
    const out = ev({
      ...ENGLAND,
      deposit: { receivedOn: "2026-01-01", protectedOn: "2026-01-10", prescribedInfoServedOn: "2026-01-15", scheme: "tds" },
    });
    expect(byId(out, "deposit-protection").status).toBe("compliant");
    expect(byId(out, "deposit-prescribed-information").status).toBe("compliant");
  });

  it("late protection is non-compliant — late action does not cure the breach", () => {
    const out = ev({ ...ENGLAND, deposit: { receivedOn: "2026-01-01", protectedOn: "2026-03-01" } });
    const protection = byId(out, "deposit-protection");
    expect(protection.status).toBe("overdue");
    expect(protection.basis.facts.late).toBe(true);
  });

  it("a recently-received deposit still within 30 days is due_soon (not yet a breach)", () => {
    const out = ev({ ...ENGLAND, deposit: { receivedOn: "2026-06-10" } }); // deadline 2026-07-10, asOf 2026-06-20
    expect(byId(out, "deposit-protection").status).toBe("due_soon");
  });

  it("no deposit on record → deposit obligations are not_applicable (never silently compliant)", () => {
    const out = ev({ ...ENGLAND });
    expect(byId(out, "deposit-protection").status).toBe("not_applicable");
    expect(byId(out, "deposit-prescribed-information").status).toBe("not_applicable");
  });

  it("out of scope → deposit obligations are not_applicable, not compliant", () => {
    const out = ev({ ...ENGLAND, deposit: { receivedOn: "2026-01-01" } }, { ...IN_SCOPE, landlordResident: true });
    expect(byId(out, "deposit-protection").status).toBe("not_applicable");
  });
});

describe("tenancy obligations (written-terms deadline; information-provision attestation)", () => {
  it("written terms not provided within 28 days of start → overdue; information not provided → overdue", () => {
    const out = ev({ ...ENGLAND, tenancy: { kind: "periodic_assured", startDate: "2026-01-01" } });
    const terms = byId(out, "tenancy-written-terms");
    expect(terms.status).toBe("overdue");
    expect(terms.dueDate).toBe("2026-01-29"); // start + 28 days
    expect(byId(out, "tenancy-information-provision").status).toBe("overdue"); // attestation, not provided
  });

  it("both provided → compliant", () => {
    const out = ev({
      ...ENGLAND,
      tenancy: { kind: "periodic_assured", startDate: "2026-01-01", writtenTermsProvidedOn: "2026-01-05", informationProvidedOn: "2026-01-02" },
    });
    expect(byId(out, "tenancy-written-terms").status).toBe("compliant");
    expect(byId(out, "tenancy-information-provision").status).toBe("compliant");
  });
});
