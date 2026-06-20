"use client";

import { Card, CardHeader, Badge, Button } from "@/components/ui";
import { formatDateTime } from "@/lib/dates";
import { now } from "@/lib/clock";
import type { BankAccount } from "@/lib/types";

const statusTone = { connected: "success", needs_reauth: "warning", disconnected: "danger" } as const;
const statusLabel = { connected: "Connected", needs_reauth: "Needs reconnect", disconnected: "Disconnected" } as const;

function consentNote(acc: BankAccount): { text: string; expired: boolean } | null {
  if (!acc.consentExpiresAt) return null;
  const days = Math.ceil((new Date(acc.consentExpiresAt).getTime() - now().getTime()) / 86_400_000);
  if (days <= 0) return { text: "Consent expired", expired: true };
  return { text: `Consent expires in ${days} day${days === 1 ? "" : "s"}`, expired: false };
}

export function BankFeedStatus({
  accounts,
  onConnect,
  onReconnect,
  onSync,
  onSimulate,
  busyAccountId,
}: {
  accounts: BankAccount[];
  onConnect: () => void;
  onReconnect: (acc: BankAccount) => void;
  onSync: (acc: BankAccount) => void;
  onSimulate: (acc: BankAccount) => void;
  busyAccountId?: string | null;
}) {
  return (
    <Card>
      <CardHeader
        title="Bank feeds"
        subtitle="Transactions import automatically from your connected accounts"
        action={<Button variant="secondary" onClick={onConnect}>Connect a bank</Button>}
      />
      <ul className="divide-y divide-slate-100">
        {accounts.map((acc) => {
          const consent = consentNote(acc);
          const busy = busyAccountId === acc.id;
          return (
            <li key={acc.id} className="flex items-center justify-between gap-3 px-5 py-3">
              <div className="min-w-0">
                <p className="text-sm font-medium text-slate-900">
                  {acc.bankName} · <span className="text-slate-500">{acc.accountName}</span>
                </p>
                <p className="text-xs text-slate-500">
                  {acc.maskedNumber}
                  {acc.lastSyncedAt ? ` · last synced ${formatDateTime(acc.lastSyncedAt)}` : ""}
                  {consent ? <span className={consent.expired ? "text-amber-600" : "text-slate-400"}> · {consent.text}</span> : null}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Badge tone={statusTone[acc.status]}>{statusLabel[acc.status]}</Badge>
                {acc.status === "needs_reauth" || consent?.expired ? (
                  <Button variant="secondary" onClick={() => onReconnect(acc)}>Reconnect</Button>
                ) : (
                  <>
                    <button onClick={() => onSimulate(acc)} disabled={busy} className="text-xs font-medium text-brand-700 hover:text-brand-800 disabled:opacity-50" title="Simulate an incoming payment webhook">
                      Simulate payment
                    </button>
                    <Button variant="ghost" onClick={() => onSync(acc)} disabled={busy}>{busy ? "Syncing…" : "Sync"}</Button>
                  </>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
