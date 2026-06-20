"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ChatIcon } from "@/components/icons";

/** Floating circular help/feedback button anchored bottom-left. */
export function FloatingHelp() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClickAway(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickAway);
    return () => document.removeEventListener("mousedown", onClickAway);
  }, []);

  return (
    <div ref={ref} className="fixed bottom-4 left-4 z-50">
      {open ? (
        <div className="mb-2 w-56 rounded-xl border border-slate-200 bg-white p-1.5 shadow-lg">
          <Link
            href="/help"
            onClick={() => setOpen(false)}
            className="block rounded-lg px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
          >
            Help &amp; how-to videos
          </Link>
          <a
            href="mailto:support@landland.app?subject=Feedback"
            className="block rounded-lg px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
          >
            Send feedback
          </a>
        </div>
      ) : null}
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label="Help and feedback"
        className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-600 text-white shadow-lg transition hover:bg-brand-700"
      >
        <ChatIcon />
      </button>
    </div>
  );
}
