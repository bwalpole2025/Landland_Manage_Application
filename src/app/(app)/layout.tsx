import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/shell/AppShell";
import { SIDEBAR_COOKIE, TRIAL_COOKIE } from "@/components/shell/shell-cookies";
import { getSession } from "@/server/auth/session";
import { now } from "@/lib/clock";

export const dynamic = "force-dynamic";

const MS_PER_DAY = 1000 * 60 * 60 * 24;

// Authenticated application shell. Every route under (app) renders inside this.
// Unauthenticated requests are redirected to /login. Sidebar-collapse and
// trial-banner-dismissal are persisted in cookies so they survive reloads.
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/login");

  const store = cookies();
  const initialCollapsed = store.get(SIDEBAR_COOKIE)?.value === "collapsed";
  const trialDismissed = store.get(TRIAL_COOKIE)?.value === "1";

  const sub = session.account.subscription;
  const active = sub.status === "TRIALING" && Boolean(sub.trialEndsAt);
  const daysLeft =
    active && sub.trialEndsAt
      ? Math.max(0, Math.ceil((new Date(sub.trialEndsAt).getTime() - now().getTime()) / MS_PER_DAY))
      : 0;

  return (
    <AppShell
      session={session}
      trial={{ active, daysLeft }}
      initialCollapsed={initialCollapsed}
      trialDismissed={trialDismissed}
    >
      {children}
    </AppShell>
  );
}
