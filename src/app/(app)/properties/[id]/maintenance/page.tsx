import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { PageHeader } from "@/components/ui";
import { MaintenanceWorkspace } from "@/components/maintenance/MaintenanceWorkspace";
import { getSession } from "@/server/auth/session";
import { prisma } from "@/server/db";
import { getProperty } from "@/services/repository";
import { listMaintenance } from "@/server/compliance/maintenance";
import { addressOneLine } from "@/lib/labels";

export const dynamic = "force-dynamic";

export default async function MaintenancePage({ params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) redirect("/login");

  const property = getProperty(params.id);
  if (!property) notFound();

  const logs = await listMaintenance(prisma, session.account.id, property.id);

  return (
    <>
      <PageHeader
        title={`Maintenance — ${property.nickname}`}
        description={`${addressOneLine(property.address)}. A repairs log timestamping each request and response — evidences hazard-response duties (Awaab's Law) and supports Section 8 grounds.`}
        actions={
          <Link href={`/properties/${property.id}/activity`} className="text-sm font-medium text-brand-600 hover:underline">
            Activity →
          </Link>
        }
      />
      <MaintenanceWorkspace propertyId={property.id} logs={logs} />
    </>
  );
}
