"use client";

import { trpc } from "@/lib/trpc/client";
import { BellIcon } from "@/components/icons";

/** Topbar bell with an unread in-app notification count, linking to the inbox. */
export function NotificationBell() {
  const { data: count } = trpc.notifications.unreadCount.useQuery(undefined, {
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
  });
  const unread = count ?? 0;

  return (
    <a
      href="/notifications"
      aria-label={unread > 0 ? `Notifications (${unread} unread)` : "Notifications"}
      className="relative rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-700"
    >
      <BellIcon />
      {unread > 0 ? (
        <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger-600 px-1 text-[10px] font-semibold text-white">
          {unread > 9 ? "9+" : unread}
        </span>
      ) : null}
    </a>
  );
}
