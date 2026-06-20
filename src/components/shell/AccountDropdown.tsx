"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/components/ds/util";
import { ChevronDownIcon } from "@/components/icons";
import type { AppSession } from "@/server/auth/session";

export function AccountDropdown({ session, collapsed }: { session: AppSession; collapsed: boolean }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    function onClickAway(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickAway);
    return () => document.removeEventListener("mousedown", onClickAway);
  }, []);

  const initials = session.user.name
    .split(/\s+/)
    .slice(0, 2)
    .map((s) => s[0])
    .join("")
    .toUpperCase();

  async function signOut() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        title={collapsed ? session.user.email : undefined}
        className={cn(
          "flex w-full items-center gap-2.5 rounded-lg p-1.5 text-left transition hover:bg-slate-100",
          collapsed && "justify-center",
        )}
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-100 text-sm font-semibold text-brand-700">
          {initials}
        </span>
        {!collapsed ? (
          <>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium text-slate-900">{session.user.name}</span>
              <span className="block truncate text-xs text-slate-500">{session.user.email}</span>
            </span>
            <ChevronDownIcon width={16} height={16} className="shrink-0 text-slate-400" />
          </>
        ) : null}
      </button>

      {open ? (
        <div
          role="menu"
          className={cn(
            "absolute z-50 w-60 rounded-xl border border-slate-200 bg-white p-1.5 shadow-lg",
            collapsed ? "left-full top-0 ml-2" : "left-0 top-full mt-1",
          )}
        >
          <div className="px-2.5 py-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Account</p>
            <p className="mt-0.5 truncate text-sm font-medium text-slate-900">{session.account.name}</p>
            <p className="truncate text-xs text-slate-500">{session.user.email}</p>
          </div>
          <div className="my-1 h-px bg-slate-100" />
          <MenuLink onClick={() => setOpen(false)} label="Profile" />
          <MenuLink onClick={() => setOpen(false)} label="Account settings" />
          <MenuLink onClick={() => setOpen(false)} label="Switch account" hint="1 account" />
          <div className="my-1 h-px bg-slate-100" />
          <button
            role="menuitem"
            onClick={signOut}
            className="w-full rounded-lg px-2.5 py-2 text-left text-sm font-medium text-danger-600 hover:bg-danger-50"
          >
            Sign out
          </button>
        </div>
      ) : null}
    </div>
  );
}

function MenuLink({ label, hint, onClick }: { label: string; hint?: string; onClick: () => void }) {
  return (
    <button
      role="menuitem"
      onClick={onClick}
      className="flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left text-sm text-slate-700 hover:bg-slate-100"
    >
      <span>{label}</span>
      {hint ? <span className="text-xs text-slate-400">{hint}</span> : null}
    </button>
  );
}
