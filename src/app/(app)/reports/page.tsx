import { PageHeader, Card, CardHeader, StatTile, Badge, Button } from "@/components/ui";
import { getTransactions } from "@/services/repository";
import { getPerPropertyPnl, getYtdTotals } from "@/lib/portfolio";
import { taxYearBounds, taxYearFor } from "@/lib/dates";
import { now } from "@/lib/clock";
import { formatGBP, sumPence } from "@/lib/money";
import { CATEGORY_META } from "@/lib/sa105";
import type { TransactionCategory } from "@/lib/types";

export default function ReportsPage() {
  const taxYear = taxYearFor(now());
  const { start, end } = taxYearBounds(taxYear);
  const ytd = getYtdTotals(taxYear);
  const pnl = getPerPropertyPnl(taxYear);

  // Expense breakdown by SA105 category.
  const expenses = getTransactions().filter(
    (t) => t.direction === "expense" && t.category && t.date >= start && t.date <= end,
  );
  const byCategory = new Map<TransactionCategory, number>();
  for (const t of expenses) {
    if (!t.category) continue;
    byCategory.set(t.category, (byCategory.get(t.category) ?? 0) + t.amountPence);
  }
  const categoryRows = [...byCategory.entries()]
    .map(([category, amount]) => ({ category, amount }))
    .sort((a, b) => b.amount - a.amount);
  const totalExpenses = sumPence(categoryRows.map((r) => r.amount));

  return (
    <>
      <PageHeader
        title="Reports"
        description={`Income, expenses and profit for ${taxYear}.`}
        actions={
          <>
            <Badge tone="neutral">Tax year {taxYear}</Badge>
            <Button variant="secondary">Export CSV</Button>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatTile label="Total income" value={formatGBP(ytd.incomePence, { showPence: false })} tone="success" />
        <StatTile label="Total expenses" value={formatGBP(ytd.expensesPence, { showPence: false })} />
        <StatTile label="Net profit" value={formatGBP(ytd.netPence, { showPence: false })} tone={ytd.netPence >= 0 ? "brand" : "danger"} />
      </div>

      <Card>
        <CardHeader title="Profit & loss by property" subtitle="Net = income − expenses for the tax year" />
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-400">
                <th className="px-5 py-3 font-medium">Property</th>
                <th className="px-5 py-3 text-right font-medium">Income</th>
                <th className="px-5 py-3 text-right font-medium">Expenses</th>
                <th className="px-5 py-3 text-right font-medium">Net</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {pnl.map((row) => (
                <tr key={row.property.id} className="hover:bg-slate-50">
                  <td className="px-5 py-3 font-medium text-slate-900">{row.property.nickname}</td>
                  <td className="px-5 py-3 text-right text-emerald-600">{formatGBP(row.incomePence, { showPence: false })}</td>
                  <td className="px-5 py-3 text-right text-slate-700">{formatGBP(row.expensesPence, { showPence: false })}</td>
                  <td className={`px-5 py-3 text-right font-semibold ${row.netPence >= 0 ? "text-slate-900" : "text-red-600"}`}>
                    {formatGBP(row.netPence, { showPence: false })}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-slate-200 bg-slate-50 font-semibold">
                <td className="px-5 py-3 text-slate-900">Total</td>
                <td className="px-5 py-3 text-right text-emerald-700">{formatGBP(ytd.incomePence, { showPence: false })}</td>
                <td className="px-5 py-3 text-right text-slate-800">{formatGBP(ytd.expensesPence, { showPence: false })}</td>
                <td className="px-5 py-3 text-right text-slate-900">{formatGBP(ytd.netPence, { showPence: false })}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </Card>

      <Card>
        <CardHeader title="Where the money goes" subtitle="Expenses by SA105 category" />
        <ul className="space-y-4 p-5">
          {categoryRows.map((row) => {
            const pct = totalExpenses === 0 ? 0 : Math.round((row.amount / totalExpenses) * 100);
            return (
              <li key={row.category}>
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium text-slate-800">
                    {CATEGORY_META[row.category].label}
                    <span className="ml-2 font-mono text-xs text-slate-400">
                      box {CATEGORY_META[row.category].sa105Box}
                    </span>
                  </span>
                  <span className="text-slate-600">
                    {formatGBP(row.amount, { showPence: false })} · {pct}%
                  </span>
                </div>
                <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-slate-100">
                  <div className="h-full rounded-full bg-brand-500" style={{ width: `${pct}%` }} />
                </div>
              </li>
            );
          })}
        </ul>
      </Card>
    </>
  );
}
