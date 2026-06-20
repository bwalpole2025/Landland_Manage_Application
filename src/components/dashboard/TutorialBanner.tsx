"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

const STORAGE_PREFIX = "landland.tutorialBanner.dismissed.";

/**
 * Dismissible "join a live tutorial" prompt. Dismissal persists per user in
 * localStorage so it stays gone across reloads.
 */
export function TutorialBanner({ userId }: { userId: string }) {
  const key = STORAGE_PREFIX + userId;
  // Start hidden to avoid a flash before localStorage is read.
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      if (localStorage.getItem(key) !== "1") setVisible(true);
    } catch {
      setVisible(true);
    }
  }, [key]);

  function dismiss() {
    try {
      localStorage.setItem(key, "1");
    } catch {
      /* ignore */
    }
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div className="flex items-center gap-3 rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900">
      <span aria-hidden className="select-none text-base">🎓</span>
      <p className="min-w-0 flex-1">
        Need help getting started? Join a live tutorial with one of our onboarding specialists.{" "}
        <Link href="/help" className="font-semibold underline underline-offset-2 hover:text-sky-950">
          Book your session
        </Link>
        .
      </p>
      <button
        onClick={dismiss}
        aria-label="Dismiss tutorial banner"
        className="shrink-0 rounded p-1 text-sky-700 hover:bg-sky-100"
      >
        ✕
      </button>
    </div>
  );
}
