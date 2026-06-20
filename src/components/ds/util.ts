/** Tiny classnames joiner (truthy values only). */
export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

/** Semantic tone shared across DS components. */
export type Tone = "brand" | "accent" | "neutral" | "success" | "warning" | "danger";
