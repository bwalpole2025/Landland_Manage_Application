import Link from "next/link";
import { AlertIcon, ChevronRightIcon } from "@/components/icons";
import { Card, CardHeader } from "@/components/ui";
import type { Alert, AlertSeverity } from "@/lib/alerts";

const severityStyles: Record<AlertSeverity, { dot: string; ring: string }> = {
  danger: { dot: "bg-red-500", ring: "text-red-500" },
  warning: { dot: "bg-amber-500", ring: "text-amber-500" },
  info: { dot: "bg-sky-500", ring: "text-sky-500" },
};

export function AlertsPanel({ alerts }: { alerts: Alert[] }) {
  return (
    <Card>
      <CardHeader
        title="Needs your attention"
        subtitle={alerts.length ? `${alerts.length} open item${alerts.length === 1 ? "" : "s"}` : undefined}
      />
      {alerts.length === 0 ? (
        <div className="px-5 py-8 text-center text-sm text-slate-500">
          Nothing outstanding — arrears, certificates and bank feeds are all healthy.
        </div>
      ) : (
        <ul className="divide-y divide-slate-100">
          {alerts.map((alert) => {
            const styles = severityStyles[alert.severity];
            return (
              <li key={alert.id}>
                <Link
                  href={alert.href}
                  className="flex items-start gap-3 px-5 py-3 transition hover:bg-slate-50"
                >
                  <AlertIcon className={`mt-0.5 shrink-0 ${styles.ring}`} width={18} height={18} />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium text-slate-900">{alert.title}</span>
                    <span className="block text-sm text-slate-500">{alert.detail}</span>
                  </span>
                  <ChevronRightIcon className="mt-0.5 shrink-0 text-slate-300" width={18} height={18} />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
