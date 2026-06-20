import { Badge } from "@/components/ui";
import { formatGBP } from "@/lib/money";
import { formatDate } from "@/lib/dates";
import { categoryLabel } from "@/lib/sa105";
import type { ReconcileStatus, Transaction } from "@/lib/types";

const reconcileTone: Record<ReconcileStatus, "success" | "warning" | "neutral"> = {
  reconciled: "success",
  unreconciled: "warning",
  ignored: "neutral",
};

const reconcileLabel: Record<ReconcileStatus, string> = {
  reconciled: "Reconciled",
  unreconciled: "Needs review",
  ignored: "Ignored",
};

export function TransactionsTable({
  rows,
  propertyNames,
}: {
  rows: Transaction[];
  propertyNames: Record<string, string>;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[680px] text-sm">
        <thead>
          <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-400">
            <th className="px-5 py-3 font-medium">Date</th>
            <th className="px-5 py-3 font-medium">Description</th>
            <th className="px-5 py-3 font-medium">Property</th>
            <th className="px-5 py-3 font-medium">Category</th>
            <th className="px-5 py-3 font-medium">Status</th>
            <th className="px-5 py-3 text-right font-medium">Amount</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((t) => (
            <tr key={t.id} className="hover:bg-slate-50">
              <td className="whitespace-nowrap px-5 py-3 text-slate-600">{formatDate(t.date)}</td>
              <td className="px-5 py-3">
                <span className="font-medium text-slate-900">{t.description}</span>
                {t.source === "bank_feed" ? (
                  <span className="ml-2 text-xs text-slate-400">via bank feed</span>
                ) : null}
              </td>
              <td className="px-5 py-3 text-slate-600">
                {t.propertyId ? propertyNames[t.propertyId] ?? "—" : <span className="text-amber-600">Unassigned</span>}
              </td>
              <td className="px-5 py-3 text-slate-600">
                {t.category ? categoryLabel(t.category) : <span className="text-amber-600">Uncategorised</span>}
              </td>
              <td className="px-5 py-3">
                <Badge tone={reconcileTone[t.reconcile]}>{reconcileLabel[t.reconcile]}</Badge>
              </td>
              <td
                className={`whitespace-nowrap px-5 py-3 text-right font-semibold ${
                  t.direction === "income" ? "text-emerald-600" : "text-slate-700"
                }`}
              >
                {t.direction === "income" ? "+" : "−"}
                {formatGBP(t.amountPence)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
