import { PageHeader, Card, CardHeader, Badge } from "@/components/ui";
import { AlertIcon } from "@/components/icons";
import { getAlerts } from "@/lib/alerts";

export default function RemindersPage() {
  const reminders = getAlerts();
  return (
    <>
      <PageHeader
        title="Reminders"
        description="Upcoming renewals and actions — compliance expiries, arrears and bank feeds."
      />
      <Card>
        <CardHeader title="Open reminders" subtitle={`${reminders.length} items`} />
        {reminders.length === 0 ? (
          <div className="px-5 py-8 text-center text-sm text-slate-500">You&apos;re all caught up.</div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {reminders.map((r) => (
              <li key={r.id} className="flex items-start gap-3 px-5 py-3">
                <AlertIcon
                  width={18}
                  height={18}
                  className={`mt-0.5 shrink-0 ${r.severity === "danger" ? "text-danger-500" : r.severity === "warning" ? "text-warning-500" : "text-brand-500"}`}
                />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-slate-900">{r.title}</p>
                  <p className="text-sm text-slate-500">{r.detail}</p>
                </div>
                <Badge tone={r.severity === "danger" ? "danger" : r.severity === "warning" ? "warning" : "neutral"}>
                  {r.severity === "danger" ? "Overdue" : "Open"}
                </Badge>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
