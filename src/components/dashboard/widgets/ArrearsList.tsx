"use client";

import { useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui";
import { ChevronRightIcon } from "@/components/icons";
import { formatGBP } from "@/lib/money";
import { formatDate } from "@/lib/dates";
import type { ArrearsRow } from "@/lib/overview";

/**
 * Arrears rows. Clicking a tenant's name expands the detail of any missing
 * rent payments. Tenancies whose rent tracking hasn't started show "Untracked".
 */
export function ArrearsList({ rows }: { rows: ArrearsRow[] }) {
  const [openId, setOpenId] = useState<string | null>(null);

  return (
    <ul className="divide-y divide-slate-100">
      {rows.map((row) => {
        const expanded = openId === row.tenancyId;
        const untracked = row.status === "untracked";
        return (
          <li key={row.tenancyId}>
            <div className="flex items-center justify-between gap-3 px-5 py-3">
              <div className="min-w-0">
                {/* Clicking the tenant name opens the missing-payment detail. */}
                <button
                  onClick={() => !untracked && setOpenId(expanded ? null : row.tenancyId)}
                  className="flex items-center gap-1 text-left text-sm font-medium text-slate-900 hover:text-brand-700 disabled:hover:text-slate-900"
                  disabled={untracked}
                  aria-expanded={expanded}
                  title={untracked ? undefined : "Show missing payments"}
                >
                  {row.tenantName}
                  {!untracked ? (
                    <ChevronRightIcon
                      width={14}
                      height={14}
                      className={`text-slate-400 transition-transform ${expanded ? "rotate-90" : ""}`}
                    />
                  ) : null}
                </button>
                <p className="truncate text-xs text-slate-500">{row.propertyAddress}</p>
              </div>

              {untracked ? (
                <Badge tone="neutral">Untracked</Badge>
              ) : (
                <span className="shrink-0 text-right">
                  <span className="block text-sm font-semibold text-red-600">{formatGBP(row.balancePence, { showPence: false })}</span>
                  <span className="block text-xs text-slate-500">
                    {row.monthsBehind} month{row.monthsBehind === 1 ? "" : "s"} behind
                  </span>
                </span>
              )}
            </div>

            {untracked ? (
              <p className="px-5 pb-3 text-xs text-slate-400">
                Rent tracking hasn&apos;t started.{" "}
                <Link href="/transactions" className="font-medium text-brand-600 hover:text-brand-700">
                  Track a payment
                </Link>{" "}
                to monitor arrears.
              </p>
            ) : expanded ? (
              <div className="border-t border-slate-100 bg-slate-50/60 px-5 py-2.5">
                <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">Missing payments</p>
                {row.missingDueDates.length === 0 ? (
                  <p className="text-xs text-slate-500">A partial shortfall against this tenancy&apos;s schedule.</p>
                ) : (
                  <ul className="space-y-1">
                    {row.missingDueDates.map((d) => (
                      <li key={d} className="flex items-center justify-between text-sm">
                        <span className="text-slate-600">Rent due {formatDate(d)}</span>
                        <span className="font-medium text-red-600">{formatGBP(row.rentPence, { showPence: false })}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
