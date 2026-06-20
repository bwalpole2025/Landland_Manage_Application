import type { Address, ComplianceDocType, PropertyType } from "./types";

export const PROPERTY_TYPE_LABELS: Record<PropertyType, string> = {
  flat: "Flat",
  terraced: "Terraced house",
  semi_detached: "Semi-detached house",
  detached: "Detached house",
  hmo: "HMO",
  commercial: "Commercial",
};

export const DOC_TYPE_LABELS: Record<ComplianceDocType, string> = {
  gas_safety: "Gas safety (CP12)",
  eicr: "EICR (electrical)",
  epc: "EPC",
  insurance: "Insurance",
  tenancy_agreement: "Tenancy agreement",
  right_to_rent: "Right to rent",
  deposit_protection: "Deposit protection",
  other: "Other",
};

export function addressOneLine(a: Address): string {
  return [a.line1, a.line2, a.city, a.postcode].filter(Boolean).join(", ");
}
