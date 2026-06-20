// Derived property-finance calculations. These are computed on demand (not
// stored): annual yield, loan-to-value, and rent annualisation. All money is
// integer minor units (pence).

export type Frequency = "MONTHLY" | "WEEKLY" | "QUARTERLY" | "ANNUALLY";

const PERIODS_PER_YEAR: Record<Frequency, number> = {
  WEEKLY: 52,
  MONTHLY: 12,
  QUARTERLY: 4,
  ANNUALLY: 1,
};

/** Annualised amount in minor units for a given per-period amount + frequency. */
export function annualiseMinor(amountMinor: number, frequency: Frequency): number {
  return Math.round(amountMinor * PERIODS_PER_YEAR[frequency]);
}

/**
 * Gross annual yield as a percentage: annual rental income / valuation.
 * Returns null when valuation is missing or zero.
 */
export function annualYieldPercent(
  rentMinor: number,
  frequency: Frequency,
  valuationMinor: number | null | undefined,
): number | null {
  if (!valuationMinor) return null;
  const annual = annualiseMinor(rentMinor, frequency);
  return Math.round((annual / valuationMinor) * 10000) / 100; // 2 dp
}

/**
 * Loan-to-value as a percentage: outstanding mortgage balance / valuation.
 * Returns null when valuation is missing or zero.
 */
export function loanToValuePercent(
  balanceMinor: number,
  valuationMinor: number | null | undefined,
): number | null {
  if (!valuationMinor) return null;
  return Math.round((balanceMinor / valuationMinor) * 10000) / 100; // 2 dp
}
