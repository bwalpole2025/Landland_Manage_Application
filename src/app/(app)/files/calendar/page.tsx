import { PageHeader, Card, CardHeader } from "@/components/ui";
import { ExpiryBadge } from "@/components/ExpiryBadge";
import { getComplianceDocuments, getProperties } from "@/services/repository";
import { expiryUrgency, formatDate } from "@/lib/dates";
import { DOC_TYPE_LABELS } from "@/lib/labels";

export default function CalendarPage() {
  const properties = getProperties();
  const propertyName = (id: string) => properties.find((p) => p.id === id)?.nickname ?? "—";

  const upcoming = getComplianceDocuments()
    .filter((d) => d.expiryDate)
    .sort((a, b) => expiryUrgency(a.expiryDate).days! - expiryUrgency(b.expiryDate).days!);

  return (
    <>
      <PageHeader title="Calendar" description="Key dates across your portfolio — certificate renewals and deadlines." />
      <Card>
        <CardHeader title="Upcoming dates" subtitle={`${upcoming.length} dated items`} />
        <ul className="divide-y divide-slate-100">
          {upcoming.map((doc) => (
            <li key={doc.id} className="flex items-center gap-4 px-5 py-3">
              <div className="w-28 shrink-0 text-sm font-medium text-slate-900">
                {doc.expiryDate ? formatDate(doc.expiryDate) : "—"}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-slate-900">{DOC_TYPE_LABELS[doc.type]}</p>
                <p className="text-xs text-slate-500">{propertyName(doc.propertyId)}</p>
              </div>
              <ExpiryBadge expiryDate={doc.expiryDate} />
            </li>
          ))}
        </ul>
      </Card>
    </>
  );
}
