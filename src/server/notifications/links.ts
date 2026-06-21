import { env } from "@/server/env";

/** Absolute URL for a relative in-app href (used in emails / push deep links). */
export function appUrl(href?: string | null): string {
  const base = env.appUrl.replace(/\/$/, "");
  if (!href) return base;
  return href.startsWith("http") ? href : `${base}${href.startsWith("/") ? "" : "/"}${href}`;
}
