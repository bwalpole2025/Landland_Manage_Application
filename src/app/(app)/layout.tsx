import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/shell/AppShell";
import { SIDEBAR_COOKIE, TRIAL_COOKIE } from "@/components/shell/shell-cookies";
import { getSession } from "@/server/auth/session";
import { subscriptionView } from "@/lib/subscription";
import { now } from "@/lib/clock";

export const dynamic = "force-dynamic";

// Authenticated application shell. Every route under (app) renders inside this.
// Unauthenticated requests are redirected to /login. Sidebar-collapse and
// billing-banner-dismissal are persisted in cookies so they survive reloads.
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/login");

  const store = cookies();
  const initialCollapsed = store.get(SIDEBAR_COOKIE)?.value === "collapsed";
  const bannerDismissed = store.get(TRIAL_COOKIE)?.value === "1";

  const { banner } = subscriptionView(session.account.subscription, now());

  return (
    <AppShell
      session={session}
      banner={banner}
      initialCollapsed={initialCollapsed}
      bannerDismissed={bannerDismissed}
    >
      {children}
    </AppShell>
  );
}
