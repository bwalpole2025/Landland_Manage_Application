"use client";

import { useState, type ReactNode } from "react";
import { Sidebar } from "./Sidebar";
import { Breadcrumbs } from "./Breadcrumbs";
import { BillingBanner } from "./BillingBanner";
import { FloatingHelp } from "./FloatingHelp";
import { CoachmarkProvider } from "@/components/coachmarks/CoachmarkProvider";
import { NotificationBell } from "./NotificationBell";
import { SIDEBAR_COOKIE, TRIAL_COOKIE } from "./shell-cookies";
import type { AppSession } from "@/server/auth/session";
import type { BannerState } from "@/lib/subscription";

function writeCookie(name: string, value: string) {
  document.cookie = `${name}=${value};path=/;max-age=31536000;samesite=lax`;
}

export interface AppShellProps {
  session: AppSession;
  banner: BannerState | null;
  initialCollapsed: boolean;
  bannerDismissed: boolean;
  children: ReactNode;
}

export function AppShell({ session, banner, initialCollapsed, bannerDismissed, children }: AppShellProps) {
  const [collapsed, setCollapsed] = useState(initialCollapsed);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [bannerOpen, setBannerOpen] = useState(Boolean(banner) && !bannerDismissed);

  function toggleCollapse() {
    setCollapsed((prev) => {
      const next = !prev;
      writeCookie(SIDEBAR_COOKIE, next ? "collapsed" : "expanded");
      return next;
    });
  }

  function dismissBanner() {
    setBannerOpen(false);
    writeCookie(TRIAL_COOKIE, "1");
  }

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50">
      {/* Skip link — first tab stop, visible only when focused. */}
      <a
        href="#main-content"
        className="sr-only z-50 rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-white"
      >
        Skip to main content
      </a>
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
            <NotificationBell />
          </div>
        </header>

        {bannerOpen && banner ? <BillingBanner banner={banner} onDismiss={dismissBanner} /> : null}

        <main id="main-content" tabIndex={-1} className="flex-1 overflow-y-auto">
          <CoachmarkProvider userId={session.user.id}>
            <div className="mx-auto max-w-6xl space-y-6 px-4 py-6 lg:px-8 lg:py-8">{children}</div>
          </CoachmarkProvider>
        </main>
      </div>

      <FloatingHelp />
    </div>
  );
}
