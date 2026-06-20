// The scaffold pins "today" so the seeded scenario (arrears, document expiry,
// the current MTD quarter) always renders in its intended state regardless of
// the machine clock. In production, replace the body of `now()` with
// `return new Date();`.

export const REFERENCE_NOW = new Date("2026-06-20T12:00:00.000Z");

export function now(): Date {
  return REFERENCE_NOW;
}
