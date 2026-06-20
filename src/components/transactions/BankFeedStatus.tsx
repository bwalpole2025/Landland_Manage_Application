import { Card, CardHeader, Badge, Button } from "@/components/ui";
import { formatDateTime } from "@/lib/dates";
import type { BankAccount } from "@/lib/types";

const statusTone = {
  connected: "success",
  needs_reauth: "warning",
  disconnected: "danger",
} as const;

const statusLabel = {
  connected: "Connected",
  needs_reauth: "Needs reconnect",
  disconnected: "Disconnected",
} as const;

export function BankFeedStatus({ accounts }: { accounts: BankAccount[] }) {
  return (
    <Card>
      <CardHeader
        title="Bank feeds"
        subtitle="Transactions import automatically from your connected accounts"
        action={<Button variant="secondary">Connect a bank</Button>}
      />
      <ul className="divide-y divide-slate-100">
        {accounts.map((acc) => (
          <li key={acc.id} className="flex items-center justify-between gap-3 px-5 py-3">
            <div className="min-w-0">
              <p className="text-sm font-medium text-slate-900">
                {acc.bankName} · <span className="text-slate-500">{acc.accountName}</span>
              </p>
              <p className="text-xs text-slate-500">
                {acc.maskedNumber}
                {acc.lastSyncedAt ? ` · last synced ${formatDateTime(acc.lastSyncedAt)}` : ""}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Badge tone={statusTone[acc.status]}>{statusLabel[acc.status]}</Badge>
              {acc.status === "needs_reauth" ? (
                <Button variant="secondary">Reconnect</Button>
              ) : (
                <Button variant="ghost">Sync</Button>
              )}
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
}
