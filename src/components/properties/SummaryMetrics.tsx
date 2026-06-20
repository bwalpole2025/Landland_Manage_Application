import Link from "next/link";
import { Card } from "@/components/ui";
import { formatGBP } from "@/lib/money";

export interface SummaryData {
  portfolioCount: number;
  propertyCount: number;
  activeTenancyCount: number;
  vacantCount: number;
  arrearsPence: number;
  creditPence: number;
}

const gbp = (p: number) => formatGBP(p, { showPence: false });

/** The four portfolio summary cards shared by Properties and Tenancies. */
export function SummaryMetrics({ summary }: { summary: SummaryData }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <Metric label="Portfolios" value={String(summary.portfolioCount)} action={<Link href="/properties/ownership" className="text-xs font-medium text-brand-700 hover:text-brand-800">+ Add Portfolio</Link>} />
      <Metric label="Properties" value={String(summary.propertyCount)} action={<Link href="/properties" className="text-xs font-medium text-brand-700 hover:text-brand-800">+ Add Property</Link>} />
      <Metric label="Tenancies" value={String(summary.activeTenancyCount)} sub={<span className={summary.vacantCount > 0 ? "text-amber-600" : "text-slate-400"}>{summary.vacantCount} vacant</span>} />
      <Metric label="Credit & Arrears" value={gbp(summary.arrearsPence)} valueTone={summary.arrearsPence > 0 ? "danger" : "default"} sub={<span className="text-slate-400">{gbp(summary.creditPence)} in credit</span>} action={<Link href="/transactions" className="text-xs font-medium text-brand-700 hover:text-brand-800">Add Transactions</Link>} />
    </div>
  );
}

function Metric({ label, value, sub, action, valueTone = "default" }: { label: string; value: string; sub?: React.ReactNode; action?: React.ReactNode; valueTone?: "default" | "danger" }) {
  return (
    <Card className="p-5">
      <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">{label}</div>
      <div className={`mt-2 text-2xl font-bold tracking-tight ${valueTone === "danger" ? "text-red-600" : "text-slate-900"}`}>{value}</div>
      <div className="mt-1 flex items-center justify-between gap-2 text-sm"><span>{sub}</span>{action}</div>
    </Card>
  );
}
