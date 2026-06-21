"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardHeader, Button } from "@/components/ui";
import { CheckIcon, LockIcon } from "@/components/icons";
import { HMRC_LINKS } from "@/lib/mtd-links";

interface PrereqItem {
  id: string;
  label: string;
  detail: string;
  link?: { href: string; label: string };
}

const ITEMS: PrereqItem[] = [
  {
    id: "gateway",
    label: "Have your Government Gateway login ready",
    detail: "You'll need your National Insurance number and your Government Gateway user ID and password.",
  },
  {
    id: "register",
    label: "Register for HMRC online services",
    detail: "Only if you don't already have a Government Gateway account.",
    link: { href: HMRC_LINKS.register, label: "Register for HMRC online services" },
  },
  {
    id: "signup",
    label: "Sign up for MTD for Income Tax",
    detail: "Sign up as an individual in your Government Gateway account.",
    link: { href: HMRC_LINKS.signUp, label: "Sign up for MTD for Income Tax" },
  },
];

const PREFIX = "landland.mtd.prereqs.";

export function MtdPrerequisites({ userId, subscribed }: { userId: string; subscribed: boolean }) {
  const key = PREFIX + userId;
  const [checked, setChecked] = useState<Set<string>>(new Set());

  useEffect(() => {
    try {
      const raw = localStorage.getItem(key);
      if (raw) setChecked(new Set(JSON.parse(raw) as string[]));
    } catch { /* ignore */ }
  }, [key]);

  function toggle(id: string) {
    setChecked((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      try { localStorage.setItem(key, JSON.stringify([...next])); } catch { /* ignore */ }
      return next;
    });
  }

  const allDone = ITEMS.every((i) => checked.has(i.id));

  return (
    <Card>
      <CardHeader title="Before you connect: prerequisites" subtitle={`${checked.size}/${ITEMS.length} ready`} />
      <ul className="divide-y divide-slate-100">
        {ITEMS.map((item) => {
          const done = checked.has(item.id);
          return (
            <li key={item.id} className="flex items-start gap-3 px-5 py-4">
              <button
                onClick={() => toggle(item.id)}
                aria-pressed={done}
                aria-label={`Mark "${item.label}" ${done ? "incomplete" : "complete"}`}
                className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${done ? "bg-brand-600 text-white" : "border-2 border-slate-300 bg-white"}`}
              >
                {done ? <CheckIcon width={14} height={14} /> : null}
              </button>
              <div className="min-w-0 flex-1">
                <p className={`text-sm font-medium ${done ? "text-slate-500 line-through" : "text-slate-900"}`}>{item.label}</p>
                <p className="text-sm text-slate-500">{item.detail}</p>
                {item.link ? (
                  <a href={item.link.href} target="_blank" rel="noopener noreferrer" className="mt-1 inline-flex items-center gap-1 text-sm font-medium text-brand-700 hover:text-brand-800">
                    {item.link.label} <span aria-hidden>↗</span>
                  </a>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-5 py-4">
        {subscribed ? (
          <span className="text-sm text-slate-500">{allDone ? "All prerequisites ready — you can connect to HMRC." : "Tick each step once it's done."}</span>
        ) : (
          <span className="flex items-center gap-1.5 text-sm text-slate-500"><LockIcon width={14} height={14} /> Connecting to HMRC requires an active subscription.</span>
        )}
        {subscribed ? (
          <Button disabled={!allDone}>Connect to HMRC</Button>
        ) : (
          <Link href="/settings" className="inline-flex items-center rounded-pill bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700">Subscribe to connect</Link>
        )}
      </div>
    </Card>
  );
}
