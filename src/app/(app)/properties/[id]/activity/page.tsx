import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { PageHeader } from "@/components/ui";
import { ActivityWorkspace } from "@/components/activity/ActivityWorkspace";
import { getSession } from "@/server/auth/session";
import { prisma } from "@/server/db";
import { getProperty } from "@/services/repository";
import { listActivity } from "@/server/compliance/activity";
import { addressOneLine } from "@/lib/labels";

export const dynamic = "force-dynamic";

export default async function ActivityPage({ params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) redirect("/login");

  const property = getProperty(params.id);
  if (!property) notFound();

  const entries = await listActivity(prisma, session.account.id, property.id);

  return (
    <>
      <PageHeader
        title={`Activity — ${property.nickname}`}
        description={`${addressOneLine(property.address)}. An append-only audit trail: who changed what and when. Rows are never edited or deleted — a correction is a new row.`}
        actions={
          <Link href={`/properties/${property.id}`} className="text-sm font-medium text-brand-600 hover:underline">
            ← Back to property
          </Link>
        }
      />
      <ActivityWorkspace propertyId={property.id} entries={entries} />
    </>
  );
}
