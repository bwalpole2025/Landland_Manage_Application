// The canonical citations for the UK rule rows. Kept in one place (and free of
// imports) so rules, predicates and the scope test all cite identical text. The
// engine is the sole origin of these strings; the presentation layer must not
// invent or alter them.

export const CITATIONS = {
  rraScope:
    "Renters' Rights Act 2024 — assured-tenancy conditions (Housing Act 1988, s.1 & Sch. 1)",
  gas: "Gas Safety (Installation and Use) Regulations 1998, reg. 36",
  eicr: "Electrical Safety Standards in the Private Rented Sector (England) Regulations 2020, reg. 3",
  epc: "Energy Performance of Buildings (England and Wales) Regulations 2012, reg. 6(5)",
  hmoLicence: "Housing Act 2004, Part 2 — mandatory HMO licensing",
  selectiveLicence: "Housing Act 2004, Part 3 — selective licensing",
  smokeCoAlarm: "The Smoke and Carbon Monoxide Alarm (England) Regulations 2015 (as amended 2022)",
  additionalLicence: "Housing Act 2004, Part 2 — additional HMO licensing (designated area)",
  rightToRent: "Immigration Act 2014, ss.20–22 — Right to Rent checks (England)",
  depositProtection: "Housing Act 2004, s.213(3) — protect the deposit in an authorised scheme within 30 days of receipt",
  depositPrescribedInfo: "Housing Act 2004, s.213(6) — serve the prescribed information within 30 days of receipt",
  writtenStatement: "Renters' Rights Act 2024 — written statement of tenancy terms",
  informationProvision: "Renters' Rights Act 2024 — tenant information (e.g. How to Rent guide)",
} as const;

export type CitationKey = keyof typeof CITATIONS;
