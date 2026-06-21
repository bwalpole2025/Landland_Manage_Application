"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc/client";
import { Button } from "@/components/ui";
import { SettingsCard, Labeled, StatusLine } from "./parts";

export function PrivacySection({ accountName }: { accountName: string }) {
  const audit = trpc.privacy.audit.useQuery({ limit: 20 });
  const del = trpc.privacy.deleteAccount.useMutation();
  const [confirmName, setConfirmName] = useState("");
  const [status, setStatus] = useState<{ kind: "ok" | "err"; message: string } | null>(null);

  async function onDelete() {
    setStatus(null);
    try {
      await del.mutateAsync({ confirmName });
      // Session is cleared server-side; send the user to login.
      window.location.href = "/login";
    } catch (err) {
      setStatus({ kind: "err", message: err instanceof Error ? err.message : "Could not delete." });
    }
  }

  return (
    <>
      <SettingsCard
        title="Your data (GDPR)"
        description="Download everything we hold for your account, or permanently delete it."
      >
        <div className="flex flex-wrap items-center gap-3">
          <a
            href="/api/privacy/export"
            className="inline-flex items-center rounded-pill bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
          >
            Export my data (JSON)
          </a>
          <span className="text-xs text-slate-400">A machine-readable copy of your account, properties, transactions and more.</span>
        </div>

        <div className="mt-5 rounded-card border border-danger-200 bg-danger-50/50 p-4">
          <p className="text-sm font-semibold text-danger-800">Delete account</p>
          <p className="mt-1 text-sm text-slate-600">
            This permanently erases the account and all its data for every user. This cannot be undone.
          </p>
          <div className="mt-3 max-w-sm">
            <Labeled label={`Type "${accountName}" to confirm`}>
              <input
                className="input"
                value={confirmName}
                onChange={(e) => setConfirmName(e.target.value)}
                aria-label="Confirm account name to delete"
              />
            </Labeled>
          </div>
          <div className="mt-3 flex items-center gap-3">
            <StatusLine status={status} />
            <Button variant="secondary" onClick={onDelete} disabled={confirmName !== accountName || del.isPending}>
              {del.isPending ? "Deleting…" : "Delete account permanently"}
            </Button>
          </div>
        </div>
      </SettingsCard>

      <SettingsCard
        title="Activity log"
        description="An audit trail of financial changes and submissions to HMRC."
      >
        {audit.isLoading ? (
          <div className="h-16 animate-pulse rounded bg-slate-100" />
        ) : audit.data && audit.data.length > 0 ? (
          <ul className="divide-y divide-slate-100 text-sm">
            {audit.data.map((e) => (
              <li key={e.id} className="flex items-center justify-between gap-3 py-2">
                <span className="min-w-0">
                  <span className="rounded-pill bg-slate-100 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    {e.action}
                  </span>{" "}
                  <span className="text-slate-700">{e.summary}</span>
                </span>
                <time className="shrink-0 text-xs text-slate-400">
                  {new Date(e.createdAt).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}
                </time>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-slate-500">No activity recorded yet.</p>
        )}
      </SettingsCard>
    </>
  );
}
