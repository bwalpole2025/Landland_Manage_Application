"use client";

import { createContext, useContext, type ReactNode } from "react";

// Makes the signed-in user's id available to client-side coachmarks so their
// "seen"/"dismissed" state can be persisted per user. The provider is mounted
// once in the app shell; section pages render <SectionCoachmark> beneath it.

const UserIdContext = createContext<string | null>(null);

export function CoachmarkProvider({ userId, children }: { userId: string; children: ReactNode }) {
  return <UserIdContext.Provider value={userId}>{children}</UserIdContext.Provider>;
}

/** The current user id, or null if rendered outside the provider. */
export function useCoachmarkUserId(): string | null {
  return useContext(UserIdContext);
}
