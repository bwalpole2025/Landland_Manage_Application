"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CheckIcon, ChevronRightIcon, ChevronDownIcon, AlertIcon } from "@/components/icons";
import { ProgressBar } from "@/components/ui";

export interface OnboardingStep {
  key: string;
  label: string;
  description: string;
  href: string;
  done: boolean;
  /** Optional count badge (e.g. number of transactions tracked). */
  count?: number;
}

const COLLAPSE_PREFIX = "landland.onboarding.collapsed.";

export function OnboardingChecklist({
  steps,
  emailVerified,
  userId,
}: {
  steps: OnboardingStep[];
  emailVerified: boolean;
  userId: string;
}) {
  const doneCount = steps.filter((s) => s.done).length;
  const remaining = steps.length - doneCount;
  const allDone = remaining === 0;

  // Collapse state persists per user across reloads.
  const collapseKey = COLLAPSE_PREFIX + userId;
  const [collapsed, setCollapsed] = useState(false);
  useEffect(() => {
    try {
      if (localStorage.getItem(collapseKey) === "1") setCollapsed(true);
    } catch {
      /* ignore */
    }
  }, [collapseKey]);

  function toggleCollapsed() {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(collapseKey, next ? "1" : "0");
      } catch {
        /* ignore */
      }
      return next;
    });
  }

  const title = allDone
    ? "You've said goodbye to your spreadsheet 🎉"
    : `You're ${remaining} step${remaining === 1 ? "" : "s"} away from saying goodbye to your spreadsheet.`;

  return (
    <section className="overflow-hidden rounded-xl border border-brand-200 bg-gradient-to-br from-brand-50 to-white shadow-sm">
      <div className="flex items-start justify-between gap-4 px-5 py-4">
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-brand-900">{title}</h2>
          <p className="mt-0.5 text-sm text-brand-800/80">
            {allDone
              ? "Your account is fully set up — Landland is tracking everything for you."
              : "A few quick steps to get your portfolio fully tracked."}
          </p>
        </div>
        <button
          onClick={toggleCollapsed}
          aria-expanded={!collapsed}
          aria-label={collapsed ? "Expand checklist" : "Collapse checklist"}
          className="shrink-0 rounded-lg p-1.5 text-brand-600 transition hover:bg-brand-100"
        >
          <ChevronDownIcon className={`transition-transform ${collapsed ? "-rotate-90" : ""}`} />
        </button>
      </div>

      {!collapsed ? (
        <>
          <div className="px-5">
            <div className="flex items-center gap-3">
              <ProgressBar value={doneCount} max={steps.length} />
              <span className="shrink-0 text-sm font-medium text-brand-800">
                {doneCount}/{steps.length}
              </span>
            </div>
          </div>

          {!emailVerified ? (
            <Link
              href="/help"
              className="mt-4 flex items-center gap-2.5 border-y border-amber-200 bg-amber-50 px-5 py-3 text-sm font-medium text-amber-900 transition hover:bg-amber-100"
            >
              <AlertIcon width={18} height={18} className="shrink-0 text-amber-500" />
              <span className="flex-1">Please verify your email address</span>
              <ChevronRightIcon width={16} height={16} className="shrink-0 text-amber-500" />
            </Link>
          ) : null}

          <ul className={`divide-y divide-brand-100 ${emailVerified ? "mt-4 border-t border-brand-100" : ""}`}>
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
                  {typeof step.count === "number" && step.count > 0 ? (
                    <span className="shrink-0 rounded-full bg-brand-100 px-2.5 py-0.5 text-xs font-semibold text-brand-700">
                      {step.count}
                    </span>
                  ) : null}
                  {!step.done ? <ChevronRightIcon className="shrink-0 text-brand-400" /> : null}
                </Link>
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </section>
  );
}
