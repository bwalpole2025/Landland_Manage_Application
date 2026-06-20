import { PageHeader, Card, CardHeader, StatTile, Badge, Button } from "@/components/ui";
import { ExpiryBadge } from "@/components/ExpiryBadge";
import { getComplianceDocuments, getProperties } from "@/services/repository";
import { expiryUrgency, formatDate, REMINDER_THRESHOLDS } from "@/lib/dates";
import { DOC_TYPE_LABELS } from "@/lib/labels";

export default function FilesPage() {
  const properties = getProperties();
  const propertyName = (id: string) => properties.find((p) => p.id === id)?.nickname ?? "—";

  // Sort: most urgent (expired / soonest) first; documents without expiry last.
  const docs = [...getComplianceDocuments()].sort((a, b) => {
    const da = a.expiryDate ? expiryUrgency(a.expiryDate).days! : Number.POSITIVE_INFINITY;
    const db = b.expiryDate ? expiryUrgency(b.expiryDate).days! : Number.POSITIVE_INFINITY;
    return da - db;
  });

  const expired = docs.filter((d) => d.expiryDate && expiryUrgency(d.expiryDate).urgency === "expired").length;
  const dueSoon = docs.filter((d) => {
    if (!d.expiryDate) return false;
    const u = expiryUrgency(d.expiryDate).urgency;
    return u === "critical" || u === "soon" || u === "upcoming";
  }).length;
  const valid = docs.filter((d) => d.expiryDate && expiryUrgency(d.expiryDate).urgency === "ok").length;

  return (
    <>
      <PageHeader
        title="Files & Dates"
        description="Store certificates and documents, and never miss a renewal."
        actions={<Button>Upload document</Button>}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatTile label="Expired" value={String(expired)} tone={expired > 0 ? "danger" : "success"} sub="needs action now" />
        <StatTile label="Due soon" value={String(dueSoon)} tone={dueSoon > 0 ? "warning" : "success"} sub="within 30 days" />
        <StatTile label="Valid" value={String(valid)} tone="success" sub="no action needed" />
      </div>

      <div className="rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
        <span className="font-medium text-slate-800">Reminder schedule:</span> we&apos;ll alert you at{" "}
        {REMINDER_THRESHOLDS.map((d, i) => (
          <span key={d}>
            <Badge tone="neutral">{d} day{d === 1 ? "" : "s"}</Badge>
            {i < REMINDER_THRESHOLDS.length - 1 ? " " : ""}
          </span>
        ))}{" "}
        before each expiry.
      </div>

      <Card>
        <CardHeader title="Documents" subtitle={`${docs.length} stored across ${properties.length} properties`} />
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-400">
                <th className="px-5 py-3 font-medium">Document</th>
                <th className="px-5 py-3 font-medium">Property</th>
                <th className="px-5 py-3 font-medium">Type</th>
                <th className="px-5 py-3 font-medium">Issued</th>
                <th className="px-5 py-3 font-medium">Expires</th>
                <th className="px-5 py-3 font-medium">Status</th>
                <th className="px-5 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {docs.map((doc) => (
                <tr key={doc.id} className="hover:bg-slate-50">
                  <td className="px-5 py-3 font-medium text-slate-900">{doc.title}</td>
                  <td className="px-5 py-3 text-slate-600">{propertyName(doc.propertyId)}</td>
                  <td className="px-5 py-3 text-slate-600">{DOC_TYPE_LABELS[doc.type]}</td>
                  <td className="px-5 py-3 text-slate-600">{doc.issueDate ? formatDate(doc.issueDate) : "—"}</td>
                  <td className="px-5 py-3 text-slate-600">{doc.expiryDate ? formatDate(doc.expiryDate) : "—"}</td>
                  <td className="px-5 py-3"><ExpiryBadge expiryDate={doc.expiryDate} /></td>
                  <td className="px-5 py-3 text-right">
                    <Button variant="ghost">View</Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}
