"use client";

import { useState } from "react";
import Link from "next/link";
import { PLAN, planAnnualPriceLabel, planAnnualMonthlyEquiv } from "@/lib/subscription";

// Pricing cards with a monthly / annual billing toggle. Annual billing is 20%
// cheaper than paying monthly. Prices come from PLAN (single source of truth)
// and are shown in monospace (facts).

const gbp = (minor: number) =>
  (minor / 100).toLocaleString("en-GB", { style: "currency", currency: PLAN.currency });

const PRO_FEATURES = [
  "Unlimited properties & portfolios",
  "The full compliance engine — gas, EICR, EPC, deposits, licensing, Right to Rent, maintenance",
  "Making Tax Digital quarterly submissions to HMRC",
  "Open Banking bank-feed import & reconciliation",
  "Document vault with expiry reminders",
  "Team & accountant (“as agent”) access",
  "Append-only audit trail & GDPR tools",
  "Priority support",
];

const FREE_FEATURES = [
  "Track 1 property",
  "Income & expense logging",
  "Store your key documents",
  "Essential compliance reminders",
  "SA105 tax estimate",
];

export function PricingPlans() {
  const [billing, setBilling] = useState<"monthly" | "annual">("annual");
  const annual = billing === "annual";

  return (
    <div>
      <BillingToggle billing={billing} onChange={setBilling} />

      <div className="mx-auto mt-10 grid max-w-4xl items-start gap-6 md:grid-cols-2">
        {/* Free tier */}
        <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
          <h3 className="text-lg font-semibold text-slate-900">Free</h3>
          <p className="mt-1 text-sm text-slate-500">See your portfolio in one place.</p>
          <p className="mt-5">
            <span className="font-mono text-4xl font-extrabold tracking-tight text-slate-900">£0</span>
            <span className="ml-1 text-sm text-slate-500">forever</span>
          </p>
          <Link
            href="/register"
            className="mt-6 block rounded-lg border border-slate-300 px-4 py-2.5 text-center text-sm font-semibold text-slate-800 transition hover:border-brand-400 hover:text-brand-700"
          >
            Create free account
          </Link>
          <ul className="mt-6 space-y-3">
            {FREE_FEATURES.map((p) => (
              <li key={p} className="flex gap-2.5 text-sm text-slate-700">
                <Check />
                <span>{p}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Pro / all-access */}
        <div className="relative rounded-2xl border-2 border-brand-600 bg-white p-8 shadow-xl shadow-brand-100">
          <span className="absolute -top-3 right-6 rounded-full bg-brand-600 px-3 py-1 text-xs font-semibold text-white">
            Access all areas
          </span>
          <h3 className="text-lg font-semibold text-slate-900">PropManage Pro</h3>
          <p className="mt-1 text-sm text-slate-500">Everything PropManage does, for your whole portfolio.</p>

          <div className="mt-5 min-h-[4.5rem]">
            {annual ? (
              <>
                <p>
                  <span className="font-mono text-4xl font-extrabold tracking-tight text-slate-900">
                    {planAnnualMonthlyEquiv()}
                  </span>
                  <span className="ml-1 text-sm text-slate-500">/ month</span>
                </p>
                <p className="mt-1 text-sm text-slate-500">
                  Billed <span className="font-mono">{planAnnualPriceLabel()}</span> —{" "}
                  <span className="font-semibold text-brand-700">save {PLAN.annualDiscountPct}%</span>
                </p>
              </>
            ) : (
              <>
                <p>
                  <span className="font-mono text-4xl font-extrabold tracking-tight text-slate-900">
                    {gbp(PLAN.priceMinor)}
                  </span>
                  <span className="ml-1 text-sm text-slate-500">/ month (no VAT)</span>
                </p>
                <p className="mt-1 text-sm text-slate-500">
                  Or save {PLAN.annualDiscountPct}% with annual billing.
                </p>
              </>
            )}
          </div>

          <Link
            href="/register"
            className="mt-6 block rounded-lg bg-brand-600 px-4 py-2.5 text-center text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700"
          >
            Start 30-day free trial
          </Link>
          <ul className="mt-6 space-y-3">
            {PRO_FEATURES.map((p) => (
              <li key={p} className="flex gap-2.5 text-sm text-slate-700">
                <Check />
                <span>{p}</span>
              </li>
            ))}
          </ul>
          <p className="mt-6 text-center text-xs text-slate-400">Cancel anytime · no VAT added</p>
        </div>
      </div>
    </div>
  );
}

function BillingToggle({
  billing,
  onChange,
}: {
  billing: "monthly" | "annual";
  onChange: (b: "monthly" | "annual") => void;
}) {
  return (
    <div className="flex justify-center">
      <div className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white p-1 shadow-sm">
        <button
          type="button"
          onClick={() => onChange("monthly")}
          className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
            billing === "monthly" ? "bg-brand-600 text-white shadow-sm" : "text-slate-600 hover:text-brand-700"
          }`}
        >
          Monthly
        </button>
        <button
          type="button"
          onClick={() => onChange("annual")}
          className={`flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-medium transition ${
            billing === "annual" ? "bg-brand-600 text-white shadow-sm" : "text-slate-600 hover:text-brand-700"
          }`}
        >
          Annual
          <span
            className={`rounded-full px-1.5 py-0.5 text-[11px] font-semibold ${
              billing === "annual" ? "bg-white/20 text-white" : "bg-brand-50 text-brand-700"
            }`}
          >
            Save {PLAN.annualDiscountPct}%
          </span>
        </button>
      </div>
    </div>
  );
}

function Check() {
  return (
    <svg viewBox="0 0 20 20" fill="none" className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" aria-hidden>
      <circle cx="10" cy="10" r="9" className="fill-brand-50" />
      <path d="M6 10.5l2.5 2.5L14 7.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
