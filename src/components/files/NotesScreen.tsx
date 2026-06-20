"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Card, CardHeader, Badge } from "@/components/ui";
import { formatDate } from "@/lib/dates";
import type { AggregatedNote } from "@/lib/notes";

export interface NotesScreenProps {
  notes: AggregatedNote[];
  properties: { id: string; name: string }[];
  tenants: { id: string; name: string }[]; // tenancyId → tenant name
}

const selectClass = "h-10 appearance-none rounded-lg border border-slate-300 bg-white pl-3 pr-9 text-sm text-slate-900 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100";

const TYPE_TONE = { property: "brand", tenant: "info", transaction: "neutral" } as const;
const TYPE_LABEL = { property: "Property", tenant: "Tenant", transaction: "Transaction" } as const;

export function NotesScreen({ notes, properties, tenants }: NotesScreenProps) {
  const [property, setProperty] = useState("");
  const [tenant, setTenant] = useState("");

  const visible = useMemo(() => {
    return notes.filter((n) => {
      if (property && n.propertyId !== property) return false;
      if (tenant && n.tenancyId !== tenant) return false;
      return true;
    });
  }, [notes, property, tenant]);

  return (
    <>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Notes</h1>
        <p className="mt-1 text-sm text-slate-500">Notes from your properties, tenancies and transactions — all in one place.</p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <select aria-label="Filter by Property" className={selectClass} value={property} onChange={(e) => setProperty(e.target.value)}>
          <option value="">All properties</option>
          {properties.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <select aria-label="Filter by Tenant" className={selectClass} value={tenant} onChange={(e) => setTenant(e.target.value)}>
          <option value="">All tenants</option>
          {tenants.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
      </div>

      <Card>
        <CardHeader title="Notes" subtitle={`${visible.length} note${visible.length === 1 ? "" : "s"}`} />
        {visible.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
            <span className="text-4xl" role="img" aria-label="empty">🗒️</span>
            <p className="mt-3 text-sm font-medium text-slate-900">Nothing to show</p>
            <p className="mt-1 text-sm text-slate-500">Notes you add from a property, tenancy or transaction will appear here.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-400">
                  <th className="px-5 py-3 font-medium">Linked To</th>
                  <th className="px-5 py-3 font-medium">Description</th>
                  <th className="px-5 py-3 text-right font-medium">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {visible.map((n) => (
                  <tr key={n.id} className="hover:bg-slate-50">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        <Badge tone={TYPE_TONE[n.linkedToType]}>{TYPE_LABEL[n.linkedToType]}</Badge>
                        {n.propertyId ? (
                          <Link href={`/properties/${n.propertyId}`} className="font-medium text-brand-700 hover:text-brand-800">{n.linkedToLabel}</Link>
                        ) : (
                          <span className="font-medium text-slate-800">{n.linkedToLabel}</span>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-3 text-slate-600">{n.description}</td>
                    <td className="whitespace-nowrap px-5 py-3 text-right text-slate-500">{formatDate(n.date.slice(0, 10))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}
