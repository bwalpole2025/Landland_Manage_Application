"use client";

// DB-backed live summary, fetched client-side through the full stack:
// React → TanStack Query → tRPC → Prisma → Postgres, scoped to the session's account.

import { trpc } from "@/lib/trpc/client";
import { Card } from "@/components/ui";
import { formatGBP } from "@/lib/money";

export function DashboardStats() {
  const summary = trpc.dashboard.summary.useQuery();

  return (
    <Card className="p-5">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-900">Live from your account</h2>
        <span className="text-xs text-slate-400">via tRPC · Postgres</span>
      </div>

      {summary.isLoading ? (
        <p className="mt-3 text-sm text-slate-500">Loading…</p>
      ) : summary.isError ? (
        <p className="mt-3 text-sm text-red-600">Couldn&apos;t load summary.</p>
      ) : summary.data ? (
        <dl className="mt-3 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Stat label="Properties" value={String(summary.data.propertyCount)} />
          <Stat label="Occupied" value={String(summary.data.occupiedCount)} />
          <Stat label="Monthly rent roll" value={formatGBP(summary.data.rentRollMinor, { showPence: false })} />
          <Stat label="Needs review" value={String(summary.data.unreconciledCount)} />
        </dl>
      ) : null}
    </Card>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className="mt-0.5 text-lg font-semibold text-slate-900">{value}</dd>
    </div>
  );
}
