"use client";

// Per-user, per-section persistence for onboarding coachmarks.
//
// Suppression is keyed by both the user id and the section so that one user
// dismissing a section's coachmark never hides it for another user signed in on
// the same browser. Backed by localStorage, so it survives reloads.
//
//   "new"       — never acknowledged; the coachmark auto-opens on first visit.
//   "seen"      — acknowledged via "Ok"; won't auto-open again on this device.
//   "dismissed" — suppressed permanently via "Don't show again".

export type CoachmarkState = "new" | "seen" | "dismissed";

const PREFIX = "landland.coachmark";

function storageKey(userId: string, section: string): string {
  return `${PREFIX}.${userId}.${section}`;
}

export function readCoachmarkState(userId: string, section: string): CoachmarkState {
  try {
    const value = localStorage.getItem(storageKey(userId, section));
    return value === "seen" || value === "dismissed" ? value : "new";
  } catch {
    // Treat unavailable storage as already-seen so we never trap the user behind
    // a modal that can't remember being dismissed.
    return "seen";
  }
}

export function writeCoachmarkState(userId: string, section: string, state: Exclude<CoachmarkState, "new">): void {
  try {
    localStorage.setItem(storageKey(userId, section), state);
  } catch {
    /* ignore — storage may be unavailable (private mode, quota) */
  }
}

/** Clear a section's suppression (used by "replay" affordances and tests). */
export function resetCoachmarkState(userId: string, section: string): void {
  try {
    localStorage.removeItem(storageKey(userId, section));
  } catch {
    /* ignore */
  }
}
