import { redirect } from "next/navigation";
import { PageHeader } from "@/components/ui";
import { NotificationsInbox } from "@/components/notifications/NotificationsInbox";
import { getSession } from "@/server/auth/session";

export const dynamic = "force-dynamic";

export default async function NotificationsPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  return (
    <>
      <PageHeader
        title="Notifications"
        description="Reminders about certificate expiry, rent, bank feeds and MTD deadlines."
      />
      <NotificationsInbox />
    </>
  );
}
