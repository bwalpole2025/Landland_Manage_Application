"use client";

import { useState } from "react";
import Link from "next/link";
import { CheckIcon, ChevronRightIcon } from "@/components/icons";
import { ProgressBar } from "@/components/ui";

export interface OnboardingStep {
  key: string;
  label: string;
  description: string;
  href: string;
  done: boolean;
}

export function OnboardingChecklist({ steps }: { steps: OnboardingStep[] }) {
  const [dismissed, setDismissed] = useState(false);
  const doneCount = steps.filter((s) => s.done).length;
  const allDone = doneCount === steps.length;

  if (dismissed) return null;

  return (
    <section className="overflow-hidden rounded-xl border border-brand-200 bg-gradient-to-br from-brand-50 to-white shadow-sm">
      <div className="flex items-start justify-between gap-4 px-5 py-4">
        <div>
          <h2 className="text-base font-semibold text-brand-900">
            {allDone ? "You've ditched the spreadsheet 🎉" : "Goodbye to spreadsheets"}
          </h2>
          <p className="mt-0.5 text-sm text-brand-800/80">
            {allDone
              ? "Your account is fully set up. Landland is now tracking everything for you."
              : "A few quick steps to get your portfolio fully tracked."}
          </p>
        </div>
        {allDone ? (
          <button
            onClick={() => setDismissed(true)}
            className="rounded-lg px-2.5 py-1 text-sm font-medium text-brand-700 hover:bg-brand-100"
          >
            Dismiss
          </button>
        ) : null}
      </div>

      <div className="px-5">
        <div className="flex items-center gap-3">
          <ProgressBar value={doneCount} max={steps.length} />
          <span className="shrink-0 text-sm font-medium text-brand-800">
            {doneCount}/{steps.length}
          </span>
        </div>
      </div>

      <ul className="mt-4 divide-y divide-brand-100 border-t border-brand-100">
        {steps.map((step) => (
          <li key={step.key}>
            <Link
              href={step.href}
              className="flex items-center gap-3 px-5 py-3 transition hover:bg-brand-50/60"
            >
              <span
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${
                  step.done ? "bg-brand-600 text-white" : "border-2 border-brand-300 bg-white"
                }`}
              >
                {step.done ? <CheckIcon width={16} height={16} /> : null}
              </span>
              <span className="min-w-0 flex-1">
                <span
                  className={`block text-sm font-medium ${
                    step.done ? "text-slate-500 line-through" : "text-slate-900"
                  }`}
                >
                  {step.label}
                </span>
                <span className="block text-sm text-slate-500">{step.description}</span>
              </span>
              {!step.done ? <ChevronRightIcon className="shrink-0 text-brand-400" /> : null}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
