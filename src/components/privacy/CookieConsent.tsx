"use client";

import { useEffect, useState } from "react";

const CONSENT_COOKIE = "landland_cookie_consent";

function readConsent(): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.split("; ").find((c) => c.startsWith(`${CONSENT_COOKIE}=`));
  return match ? decodeURIComponent(match.split("=")[1]) : null;
}

function writeConsent(value: "all" | "essential") {
  document.cookie = `${CONSENT_COOKIE}=${value};path=/;max-age=31536000;samesite=lax`;
}

/**
 * Privacy-first cookie consent. Defaults to nothing non-essential: the banner
 * shows until the user makes an explicit choice. "Essential only" and "Accept
 * all" both dismiss it and record the preference. Essential cookies (session,
 * UI state) are strictly necessary and always allowed.
 */
export function CookieConsent() {
  const [decided, setDecided] = useState(true); // assume decided until mounted (avoid flash)

  useEffect(() => {
    setDecided(readConsent() !== null);
  }, []);

  if (decided) return null;

  function choose(value: "all" | "essential") {
    writeConsent(value);
    setDecided(true);
  }

  return (
    <div
      role="dialog"
      aria-label="Cookie consent"
      className="fixed inset-x-3 bottom-3 z-50 mx-auto max-w-3xl rounded-card border border-slate-200 bg-white p-4 shadow-card-hover sm:p-5"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-slate-600">
          We use strictly-necessary cookies to keep you signed in and remember your layout. With your
          consent we&apos;d also use optional cookies to improve PropManage. See our{" "}
          <a href="/help" className="font-medium text-brand-600 hover:underline">
            privacy &amp; cookie policy
          </a>
          .
        </p>
        <div className="flex shrink-0 gap-2">
          <button
            onClick={() => choose("essential")}
            className="rounded-pill border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-400"
          >
            Essential only
          </button>
          <button
            onClick={() => choose("all")}
            className="rounded-pill bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
          >
            Accept all
          </button>
        </div>
      </div>
    </div>
  );
}
