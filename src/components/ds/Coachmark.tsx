"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Modal } from "./Modal";
import { Button } from "./Button";

const STORAGE_PREFIX = "landland.coachmark.";

/**
 * Tracks whether a first-visit coachmark has been dismissed "don't show again".
 * Backed by localStorage and keyed per section.
 */
export function useCoachmark(key: string) {
  const storageKey = STORAGE_PREFIX + key;
  // Start hidden to avoid a flash before localStorage is read on the client.
  const [open, setOpen] = useState(false);

  useEffect(() => {
    try {
      if (localStorage.getItem(storageKey) !== "dismissed") setOpen(true);
    } catch {
      setOpen(true);
    }
  }, [storageKey]);

  const close = () => setOpen(false);
  const dontShowAgain = () => {
    try {
      localStorage.setItem(storageKey, "dismissed");
    } catch {
      /* ignore */
    }
    setOpen(false);
  };
  const reset = () => {
    try {
      localStorage.removeItem(storageKey);
    } catch {
      /* ignore */
    }
  };

  return { open, close, dontShowAgain, reset, setOpen };
}

export interface CoachmarkProps {
  open: boolean;
  title: ReactNode;
  children: ReactNode;
  /** Image / illustration slot shown above the body. */
  media?: ReactNode;
  confirmLabel?: string;
  onConfirm: () => void;
  onDontShowAgain: () => void;
}

/**
 * Onboarding coachmark modal shown on first visit to a section. Offers a primary
 * "Got it" action and a "Don't show again" escape hatch.
 */
export function Coachmark({
  open,
  title,
  children,
  media,
  confirmLabel = "Got it",
  onConfirm,
  onDontShowAgain,
}: CoachmarkProps) {
  return (
    <Modal
      open={open}
      onClose={onConfirm}
      size="sm"
      footer={
        <div className="flex w-full items-center justify-between">
          <button onClick={onDontShowAgain} className="text-sm font-medium text-slate-500 hover:text-slate-700">
            Don&apos;t show again
          </button>
          <Button onClick={onConfirm}>{confirmLabel}</Button>
        </div>
      }
    >
      {media ? (
        <div className="mb-4 flex items-center justify-center rounded-lg bg-brand-50 py-6 text-brand-500">{media}</div>
      ) : null}
      <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
      <div className="mt-1 text-sm text-slate-600">{children}</div>
    </Modal>
  );
}
