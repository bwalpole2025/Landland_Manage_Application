"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { HelpIcon, PlusIcon, ChevronDownIcon } from "@/components/icons";

const HELP_LINKS = [
  { label: "Getting started guide", href: "/help" },
  { label: "How-to videos", href: "/help" },
  { label: "Book a live tutorial", href: "/help" },
];

/** Overview page title with a help dropdown and a quick add-property button. */
export function OverviewHeader() {
  const [helpOpen, setHelpOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onAway(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setHelpOpen(false);
    }
    document.addEventListener("mousedown", onAway);
    return () => document.removeEventListener("mousedown", onAway);
  }, []);

  return (
    <div className="flex items-center justify-between gap-3">
      <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Overview</h1>

      <div className="flex items-center gap-2">
        <div className="relative" ref={ref}>
          <button
            onClick={() => setHelpOpen((o) => !o)}
            aria-haspopup="menu"
            aria-expanded={helpOpen}
            className="inline-flex items-center gap-1.5 rounded-pill px-3 py-2 text-sm font-medium text-slate-600 ring-1 ring-inset ring-slate-300 transition hover:bg-slate-50"
          >
            <HelpIcon width={18} height={18} />
            <span className="hidden sm:inline">Help</span>
            <ChevronDownIcon width={16} height={16} className={`transition-transform ${helpOpen ? "rotate-180" : ""}`} />
          </button>

          {helpOpen ? (
            <div role="menu" className="absolute right-0 top-full z-50 mt-1 w-56 rounded-xl border border-slate-200 bg-white p-1.5 shadow-lg">
              {HELP_LINKS.map((link) => (
                <Link
                  key={link.label}
                  href={link.href}
                  role="menuitem"
                  onClick={() => setHelpOpen(false)}
                  className="block rounded-lg px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
                >
                  {link.label}
                </Link>
              ))}
            </div>
          ) : null}
        </div>

        <Link
          href="/properties"
          aria-label="Add property"
          title="Add property"
          className="inline-flex h-10 w-10 items-center justify-center rounded-pill bg-brand-600 text-white shadow-sm transition hover:bg-brand-700"
        >
          <PlusIcon width={20} height={20} />
        </Link>
      </div>
    </div>
  );
}
