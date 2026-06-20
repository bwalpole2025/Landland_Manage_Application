"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui";
import { InfoIcon, UploadIcon } from "@/components/icons";

/** Header actions: info popover, Import file (secondary), Add bank feed (primary). */
export function TransactionsActions({ onImport, onConnect }: { onImport: () => void; onConnect: () => void }) {
  const [infoOpen, setInfoOpen] = useState(false);
  const infoRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onAway(e: MouseEvent) {
      if (infoRef.current && !infoRef.current.contains(e.target as Node)) setInfoOpen(false);
    }
    document.addEventListener("mousedown", onAway);
    return () => document.removeEventListener("mousedown", onAway);
  }, []);

  return (
    <div className="flex items-center gap-2">
      <div className="relative" ref={infoRef}>
        <button
          onClick={() => setInfoOpen((o) => !o)}
          aria-label="About transactions"
          aria-expanded={infoOpen}
          className="flex h-10 w-10 items-center justify-center rounded-pill text-slate-500 ring-1 ring-inset ring-slate-300 transition hover:bg-slate-50"
        >
          <InfoIcon width={18} height={18} />
        </button>
        {infoOpen ? (
          <div role="tooltip" className="absolute right-0 top-full z-50 mt-1 w-72 rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-600 shadow-lg">
            Your transactions ledger. Import data via a bank feed or spreadsheet, then assign each
            item to a property and an SA105 category to keep your tax estimate accurate.
          </div>
        ) : null}
      </div>

      <Button variant="secondary" onClick={onImport}>
        <UploadIcon width={16} height={16} /> Import file
      </Button>
      <Button onClick={onConnect}>Add bank feed</Button>
    </div>
  );
}
