// Configurable, versioned tax rates / allowances / thresholds, keyed by UK tax
// year. The engine reads from here — never from hard-coded constants — so a new
// tax year is a data change, not a code change.
//
// England, Wales & NI income-tax figures. Money is integer pence. These are the
// frozen thresholds that apply across 2024/25–2027/28.

import type { Pence } from "./types";

export interface TaxYearConfig {
  taxYear: string;
  /** Stamp so a statement can record exactly which ruleset produced it. */
  version: string;
  personalAllowancePence: Pence;
  /** Income above this tapers the personal allowance by £1 for every £2. */
  personalAllowanceTaperThresholdPence: Pence;
  basicRate: number;
  /** Width of the basic-rate band (taxable income after the allowance). */
  basicRateBandPence: Pence;
  higherRate: number;
  additionalRate: number;
  /** Total income at which the additional rate begins. */
  additionalRateThresholdPence: Pence;
  /** Basic-rate restriction applied to residential finance costs (a reducer). */
  financeCostReliefRate: number;
}

const FROZEN = (taxYear: string): TaxYearConfig => ({
  taxYear,
  version: `${taxYear}-r1`,
  personalAllowancePence: 1_257_000, // £12,570
  personalAllowanceTaperThresholdPence: 10_000_000, // £100,000
  basicRate: 0.2,
  basicRateBandPence: 3_770_000, // £37,700
  higherRate: 0.4,
  additionalRate: 0.45,
  additionalRateThresholdPence: 12_514_000, // £125,140
  financeCostReliefRate: 0.2,
});

export const TAX_YEAR_CONFIGS: Record<string, TaxYearConfig> = {
  "2023/24": FROZEN("2023/24"),
  "2024/25": FROZEN("2024/25"),
  "2025/26": FROZEN("2025/26"),
  "2026/27": FROZEN("2026/27"),
  "2027/28": FROZEN("2027/28"),
};

/**
 * Config for a tax year. Falls back to the latest configured year when the
 * requested one is in the future, or the earliest when it's in the past.
 */
export function getTaxConfig(taxYear: string): TaxYearConfig {
  const exact = TAX_YEAR_CONFIGS[taxYear];
  if (exact) return exact;
  const keys = Object.keys(TAX_YEAR_CONFIGS).sort();
  const notAfter = keys.filter((k) => k <= taxYear);
  const key = notAfter.length ? notAfter[notAfter.length - 1] : keys[0];
  return TAX_YEAR_CONFIGS[key];
}
