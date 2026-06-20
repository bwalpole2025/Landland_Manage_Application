import type { Pence } from "./types";

/** Format integer pence as GBP, e.g. 125000 -> "£1,250.00". */
export function formatGBP(pence: Pence, opts: { showPence?: boolean } = {}): string {
  const { showPence = true } = opts;
  const value = pence / 100;
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    minimumFractionDigits: showPence ? 2 : 0,
    maximumFractionDigits: showPence ? 2 : 0,
  }).format(value);
}

/** Compact GBP for stat tiles, e.g. 1250000 -> "£12.5k". */
export function formatGBPCompact(pence: Pence): string {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(pence / 100);
}

export function poundsToPence(pounds: number): Pence {
  return Math.round(pounds * 100);
}

export function sumPence(amounts: Pence[]): Pence {
  return amounts.reduce((total, n) => total + n, 0);
}
