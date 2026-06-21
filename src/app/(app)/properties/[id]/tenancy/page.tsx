import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { PageHeader } from "@/components/ui";
import { TenancyWorkspace } from "@/components/tenancy/TenancyWorkspace";
import { getSession } from "@/server/auth/session";
import { prisma } from "@/server/db";
import { getProperty } from "@/services/repository";
import { evaluateProperty } from "@/server/compliance/evaluate";
import { listTenancies } from "@/server/compliance/records";
import { addressOneLine } from "@/lib/labels";

export const dynamic = "force-dynamic";

const TENANCY_RULES = ["tenancy-written-terms", "tenancy-information-provision"];

export default async function TenancyPage({ params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) redirect("/login");

  const property = getProperty(params.id);
  if (!property) notFound();

  const [{ evaluation }, tenancies] = await Promise.all([
    evaluateProperty(prisma, session.account.id, property.id),
    listTenancies(prisma, session.account.id, property.id),
  ]);
  const obligations = evaluation.filter((o) => TENANCY_RULES.includes(o.ruleId));

  return (
    <>
      <PageHeader
        title={`Tenancy — ${property.nickname}`}
        description={`${addressOneLine(property.address)}. Under the Renters' Rights Act, tenancies are periodic assured by default. Record the current tenancy and meet the written-terms / information obligations.`}
        actions={
          <Link href={`/properties/${property.id}/essentials`} className="text-sm font-medium text-brand-600 hover:underline">
            Essentials →
          </Link>
        }
      />
      <TenancyWorkspace propertyId={property.id} tenancies={tenancies} obligations={obligations} />
    </>
  );
}
