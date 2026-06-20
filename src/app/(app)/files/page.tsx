import { SectionCoachmark } from "@/components/coachmarks/SectionCoachmark";
import { DocumentsArea, type DocRow, type ReceiptRow, type ReportRow } from "@/components/files/DocumentsArea";
import { getComplianceDocuments, getProperties, getProperty, getTenancies, getTransactions } from "@/services/repository";
import { categoryIdForDoc, categoryLabel, categoryGroup } from "@/lib/documents";

export const dynamic = "force-dynamic";

const REPORTS: ReportRow[] = [
  { id: "sa105", title: "SA105 tax summary", description: "Your categorised income & expenses mapped to the SA105 boxes." },
  { id: "pnl", title: "Annual profit & loss", description: "Income, expenses and profit for the tax year." },
  { id: "rent", title: "Rent statement", description: "Rent due vs received per tenancy." },
];

export default function FilesPage() {
  const properties = getProperties();
  const propertyName = (id: string) => properties.find((p) => p.id === id)?.nickname ?? "—";
  const tenancies = getTenancies();
  const tenancyLabel = (id?: string) => {
    const t = id ? tenancies.find((x) => x.id === id) : undefined;
    return t ? `${t.tenants[0]?.name ?? "Tenant"} · ${getProperty(t.propertyId)?.nickname ?? ""}` : undefined;
  };

  const docs: DocRow[] = getComplianceDocuments().map((d) => {
    const categoryId = categoryIdForDoc(d);
    return {
      id: d.id,
      title: d.title,
      categoryId,
      categoryLabel: categoryLabel(categoryId),
      group: categoryGroup(categoryId),
      type: d.type,
      propertyId: d.propertyId,
      propertyName: propertyName(d.propertyId),
      tenancyId: d.tenancyId,
      tenancyName: tenancyLabel(d.tenancyId),
      issueDate: d.issueDate,
      expiryDate: d.expiryDate,
    };
  });

  const receipts: ReceiptRow[] = getTransactions()
    .filter((t) => t.receiptRef)
    .map((t) => ({ id: t.id, description: t.description, date: t.date, propertyName: t.propertyId ? propertyName(t.propertyId) : "Unassigned", amountPence: t.amountPence }));

  const propertyOptions = properties.map((p) => ({ id: p.id, name: p.nickname }));
  const tenancyOptions = tenancies.map((t) => ({ id: t.id, label: `${t.tenants[0]?.name ?? "Tenant"} · ${getProperty(t.propertyId)?.nickname ?? ""}`, propertyId: t.propertyId }));

  return (
    <>
      <SectionCoachmark section="documents" />
      <DocumentsArea
        docs={docs}
        receipts={receipts}
        reports={REPORTS}
        properties={propertyOptions}
        tenancies={tenancyOptions}
        notificationsEnabled
      />
    </>
  );
}
