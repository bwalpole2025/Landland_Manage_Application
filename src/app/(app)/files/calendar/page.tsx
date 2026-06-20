import { redirect } from "next/navigation";
import { CalendarView } from "@/components/files/CalendarView";
import { getSession } from "@/server/auth/session";
import { getCalendarEvents, todayInZone, DEFAULT_TIME_ZONE } from "@/lib/calendar";

export const dynamic = "force-dynamic";

export default async function CalendarPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  // All date math uses the account time zone.
  const timeZone = DEFAULT_TIME_ZONE;
  const today = todayInZone(timeZone);

  // Build events for a generous window so prev/next navigation stays populated.
  const start = `${Number(today.slice(0, 4)) - 1}-01-01`;
  const end = `${Number(today.slice(0, 4)) + 2}-12-31`;
  const events = getCalendarEvents(start, end, { trialEndsAt: session.account.subscription.trialEndsAt });

  return <CalendarView events={events} today={today} />;
}
