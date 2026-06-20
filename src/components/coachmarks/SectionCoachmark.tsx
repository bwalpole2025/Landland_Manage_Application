"use client";

import { useEffect, useState } from "react";
import { Modal } from "@/components/ds/Modal";
import { Button } from "@/components/ds/Button";
import { CheckIcon, ChevronLeftIcon, ChevronRightIcon } from "@/components/icons";
import { COACHMARKS, type CoachmarkSection } from "./content";
import { useCoachmarkUserId } from "./CoachmarkProvider";
import { readCoachmarkState, writeCoachmarkState } from "./persistence";

/**
 * First-visit onboarding coachmark for a section. Auto-opens once per user per
 * section, then stays suppressed across reloads:
 *   - "Ok" acknowledges it (won't auto-open again on this device).
 *   - "Don't show again" suppresses it permanently.
 * Multi-step content (e.g. Transactions) gets dot pagination and prev/next arrows.
 */
export function SectionCoachmark({ section }: { section: CoachmarkSection }) {
  const userId = useCoachmarkUserId();
  const content = COACHMARKS[section];
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);

  // Decide visibility on the client after localStorage is readable, so there's
  // no flash and suppression survives reloads.
  useEffect(() => {
    if (!userId) return;
    if (readCoachmarkState(userId, section) === "new") setOpen(true);
  }, [userId, section]);

  if (!userId) return null;

  const steps = content.steps;
  const current = steps[step];
  const multi = steps.length > 1;
  const isLast = step === steps.length - 1;

  const acknowledge = () => {
    writeCoachmarkState(userId, section, "seen");
    setOpen(false);
  };
  const dontShowAgain = () => {
    writeCoachmarkState(userId, section, "dismissed");
    setOpen(false);
  };

  return (
    <Modal
      open={open}
      onClose={acknowledge}
      size="sm"
      footer={
        <div className="flex w-full items-center justify-between">
          <button
            onClick={dontShowAgain}
            className="text-sm font-medium text-slate-500 hover:text-slate-700"
          >
            Don&apos;t show again
          </button>
          <Button onClick={acknowledge}>Ok</Button>
        </div>
      }
    >
      <div className="mb-4 flex items-center justify-center rounded-lg bg-brand-50 py-7 text-brand-500">
        {content.icon}
      </div>

      <h2 className="text-lg font-semibold text-slate-900">{current.heading}</h2>

      <ul className="mt-3 space-y-2">
        {current.bullets.map((bullet) => (
          <li key={bullet} className="flex gap-2.5 text-sm text-slate-600">
            <CheckIcon width={16} height={16} className="mt-0.5 shrink-0 text-brand-500" />
            <span>{bullet}</span>
          </li>
        ))}
      </ul>

      {multi ? (
        <div className="mt-5 flex items-center justify-center gap-3">
          <button
            onClick={() => setStep((s) => Math.max(0, s - 1))}
            disabled={step === 0}
            aria-label="Previous"
            className="rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 disabled:opacity-30 disabled:hover:bg-transparent"
          >
            <ChevronLeftIcon width={18} height={18} />
          </button>

          <div className="flex items-center gap-1.5" role="tablist" aria-label="Steps">
            {steps.map((_, i) => (
              <button
                key={i}
                onClick={() => setStep(i)}
                aria-label={`Step ${i + 1}`}
                aria-selected={i === step}
                role="tab"
                className={`h-2 rounded-full transition-all ${
                  i === step ? "w-5 bg-brand-500" : "w-2 bg-slate-300 hover:bg-slate-400"
                }`}
              />
            ))}
          </div>

          <button
            onClick={() => setStep((s) => Math.min(steps.length - 1, s + 1))}
            disabled={isLast}
            aria-label="Next"
            className="rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 disabled:opacity-30 disabled:hover:bg-transparent"
          >
            <ChevronRightIcon width={18} height={18} />
          </button>
        </div>
      ) : null}
    </Modal>
  );
}
