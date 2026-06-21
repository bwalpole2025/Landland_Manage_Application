"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ChatIcon } from "@/components/icons";
import { HELP_LINKS } from "@/lib/help-links";

/** Floating circular help/feedback button anchored bottom-left. */
export function FloatingHelp() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClickAway(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onClickAway);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClickAway);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  const itemClass =
    "block rounded-lg px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500";

  return (
    <div ref={ref} className="fixed bottom-4 left-4 z-50">
      {open ? (
        <div role="menu" className="mb-2 w-60 rounded-xl border border-slate-200 bg-white p-1.5 shadow-lg">
          <Link href="/help" onClick={() => setOpen(false)} className={itemClass} role="menuitem">
            Help &amp; how-to videos
          </Link>
          <a href={HELP_LINKS.tutorialBooking} target="_blank" rel="noreferrer" className={itemClass} role="menuitem">
            Book a live tutorial
          </a>
          <a href={HELP_LINKS.support} className={itemClass} role="menuitem">
            Send feedback
          </a>
        </div>
      ) : null}
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label="Help and feedback"
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-600 text-white shadow-lg transition hover:bg-brand-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
      >
        <ChatIcon />
      </button>
    </div>
  );
}
