"use client";

import { trpc } from "@/lib/trpc/client";
import { Button, EmptyState } from "@/components/ui";
import { CATEGORY_LABELS, type NotificationCategory } from "@/lib/notifications";

const PRISMA_TO_CATEGORY: Record<string, NotificationCategory> = {
  DOCUMENT_EXPIRY: "document_expiry",
  ARREARS: "arrears",
  RENT_REMINDER: "rent_reminder",
  BANK_FEED: "bank_feed",
  MTD_DEADLINE: "mtd_deadline",
};

function categoryLabel(raw: string): string {
  const key = PRISMA_TO_CATEGORY[raw];
  return key ? CATEGORY_LABELS[key] : raw;
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return `${days}d ago`;
}

export function NotificationsInbox() {
  const utils = trpc.useUtils();
  const list = trpc.notifications.list.useQuery({ limit: 100 });
  const markRead = trpc.notifications.markRead.useMutation();
  const markAllRead = trpc.notifications.markAllRead.useMutation();

  async function refresh() {
    await Promise.all([
      utils.notifications.list.invalidate(),
      utils.notifications.unreadCount.invalidate(),
    ]);
  }

  const items = list.data ?? [];
  const hasUnread = items.some((i) => !i.read);

  if (list.isLoading) {
    return <div className="h-24 animate-pulse rounded-card bg-slate-100" />;
  }

  if (items.length === 0) {
    return (
      <EmptyState
        title="You're all caught up"
        description="Reminders about certificate expiry, rent, bank feeds and MTD deadlines will show up here."
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">{items.filter((i) => !i.read).length} unread</p>
        <Button
          variant="secondary"
          disabled={!hasUnread || markAllRead.isPending}
          onClick={async () => {
            await markAllRead.mutateAsync();
            await refresh();
          }}
        >
          Mark all as read
        </Button>
      </div>

      <ul className="overflow-hidden rounded-card border border-slate-200 bg-white shadow-card">
        {items.map((n) => (
          <li
            key={n.id}
            className={`flex items-start gap-3 border-b border-slate-100 px-4 py-3 last:border-b-0 ${
              n.read ? "bg-white" : "bg-brand-50/40"
            }`}
          >
            <span
              className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${n.read ? "bg-slate-200" : "bg-brand-500"}`}
              aria-hidden
            />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className="truncate text-sm font-semibold text-slate-800">{n.title}</p>
                <span className="shrink-0 text-xs text-slate-400">{timeAgo(n.createdAt)}</span>
              </div>
              <p className="mt-0.5 text-sm text-slate-600">{n.body}</p>
              <div className="mt-1.5 flex items-center gap-3 text-xs">
                <span className="rounded-pill bg-slate-100 px-2 py-0.5 text-slate-500">
                  {categoryLabel(n.category)}
                </span>
                {n.href ? (
                  <a className="font-medium text-brand-600 hover:underline" href={n.href}>
                    View
                  </a>
                ) : null}
                {!n.read ? (
                  <button
                    className="font-medium text-slate-500 hover:underline"
                    onClick={async () => {
                      await markRead.mutateAsync({ id: n.id });
                      await refresh();
                    }}
                  >
                    Mark as read
                  </button>
                ) : null}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
