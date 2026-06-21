import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { PageHeader } from "@/components/ui";
import { LicensingWorkspace } from "@/components/licensing/LicensingWorkspace";
import { getSession } from "@/server/auth/session";
import { prisma } from "@/server/db";
import { getProperty } from "@/services/repository";
import { evaluateProperty } from "@/server/compliance/evaluate";
import { listLicences } from "@/server/compliance/licensing";
import { addressOneLine } from "@/lib/labels";

export const dynamic = "force-dynamic";

const LICENCE_RULES = ["hmo-licence", "additional-licence", "selective-licence"];

export default async function LicensingPage({ params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) redirect("/login");

  const property = getProperty(params.id);
  if (!property) notFound();

  const [{ evaluation }, licences] = await Promise.all([
    evaluateProperty(prisma, session.account.id, property.id),
    listLicences(prisma, session.account.id, property.id),
  ]);
  const obligations = evaluation.filter((o) => LICENCE_RULES.includes(o.ruleId));

  return (
    <>
      <PageHeader
        title={`Licensing — ${property.nickname}`}
        description={`${addressOneLine(property.address)}. Record HMO, additional and selective licences with grant and expiry dates. Statuses come from the engine.`}
        actions={
          <Link href={`/properties/${property.id}/essentials`} className="text-sm font-medium text-brand-600 hover:underline">
            Essentials →
          </Link>
        }
      />
      <LicensingWorkspace propertyId={property.id} licences={licences} obligations={obligations} />
    </>
  );
}
