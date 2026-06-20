"use client";

import { useState, type ReactNode } from "react";
import { Sidebar } from "./Sidebar";
import { Breadcrumbs } from "./Breadcrumbs";
import { TrialBanner } from "./TrialBanner";
import { FloatingHelp } from "./FloatingHelp";
import { CoachmarkProvider } from "@/components/coachmarks/CoachmarkProvider";
import { BellIcon } from "@/components/icons";
import { SIDEBAR_COOKIE, TRIAL_COOKIE } from "./shell-cookies";
import type { AppSession } from "@/server/auth/session";

function writeCookie(name: string, value: string) {
  document.cookie = `${name}=${value};path=/;max-age=31536000;samesite=lax`;
}

export interface AppShellProps {
  session: AppSession;
  trial: { active: boolean; daysLeft: number };
  initialCollapsed: boolean;
  trialDismissed: boolean;
  children: ReactNode;
}

export function AppShell({ session, trial, initialCollapsed, trialDismissed, children }: AppShellProps) {
  const [collapsed, setCollapsed] = useState(initialCollapsed);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [trialOpen, setTrialOpen] = useState(trial.active && !trialDismissed);

  function toggleCollapse() {
    setCollapsed((prev) => {
      const next = !prev;
      writeCookie(SIDEBAR_COOKIE, next ? "collapsed" : "expanded");
      return next;
    });
  }

  function dismissTrial() {
    setTrialOpen(false);
    writeCookie(TRIAL_COOKIE, "1");
  }

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50">
      {mobileOpen ? (
        <div className="fixed inset-0 z-30 bg-slate-900/40 lg:hidden" onClick={() => setMobileOpen(false)} />
      ) : null}

      <Sidebar
        session={session}
        collapsed={collapsed}
        mobileOpen={mobileOpen}
        onToggleCollapse={toggleCollapse}
        onNavigate={() => setMobileOpen(false)}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-16 shrink-0 items-center gap-3 border-b border-slate-200 bg-white px-4 lg:px-6">
          <button
            onClick={() => setMobileOpen(true)}
            aria-label="Open menu"
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 lg:hidden"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <Breadcrumbs />
          <div className="ml-auto flex items-center gap-1">
            <a
              href="/files/reminders"
              aria-label="Reminders"
              className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-700"
            >
              <BellIcon />
            </a>
          </div>
        </header>

        {trialOpen ? <TrialBanner daysLeft={trial.daysLeft} onDismiss={dismissTrial} /> : null}

        <main className="flex-1 overflow-y-auto">
          <CoachmarkProvider userId={session.user.id}>
            <div className="mx-auto max-w-6xl space-y-6 px-4 py-6 lg:px-8 lg:py-8">{children}</div>
          </CoachmarkProvider>
        </main>
      </div>

      <FloatingHelp />
    </div>
  );
}
