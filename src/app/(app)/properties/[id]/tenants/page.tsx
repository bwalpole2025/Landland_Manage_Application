import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { PageHeader } from "@/components/ui";
import { TenantsWorkspace } from "@/components/tenants/TenantsWorkspace";
import { getSession } from "@/server/auth/session";
import { prisma } from "@/server/db";
import { getProperty } from "@/services/repository";
import { evaluateProperty } from "@/server/compliance/evaluate";
import { listTenants } from "@/server/compliance/tenants";
import { addressOneLine } from "@/lib/labels";

export const dynamic = "force-dynamic";

export default async function TenantsPage({ params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) redirect("/login");

  const property = getProperty(params.id);
  if (!property) notFound();

  const [{ evaluation }, tenants] = await Promise.all([
    evaluateProperty(prisma, session.account.id, property.id),
    listTenants(prisma, session.account.id, property.id),
  ]);
  const rightToRent = evaluation.find((o) => o.ruleId === "right-to-rent") ?? null;

  return (
    <>
      <PageHeader
        title={`Tenants — ${property.nickname}`}
        description={`${addressOneLine(property.address)}. Tenant records and Right to Rent checks (England). The check status comes from the engine.`}
        actions={
          <Link href={`/properties/${property.id}/essentials`} className="text-sm font-medium text-brand-600 hover:underline">
            Essentials →
          </Link>
        }
      />
      <TenantsWorkspace propertyId={property.id} tenants={tenants} rightToRent={rightToRent} />
    </>
  );
}
