import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { PageHeader } from "@/components/ui";
import { DepositWorkspace } from "@/components/deposit/DepositWorkspace";
import { getSession } from "@/server/auth/session";
import { prisma } from "@/server/db";
import { getProperty } from "@/services/repository";
import { evaluateProperty } from "@/server/compliance/evaluate";
import { getDeposit } from "@/server/compliance/records";
import { addressOneLine } from "@/lib/labels";

export const dynamic = "force-dynamic";

const DEPOSIT_RULES = ["deposit-protection", "deposit-prescribed-information"];

export default async function DepositPage({ params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) redirect("/login");

  const property = getProperty(params.id);
  if (!property) notFound();

  const [{ evaluation }, deposit] = await Promise.all([
    evaluateProperty(prisma, session.account.id, property.id),
    getDeposit(prisma, session.account.id, property.id),
  ]);
  const obligations = evaluation.filter((o) => DEPOSIT_RULES.includes(o.ruleId));

  return (
    <>
      <PageHeader
        title={`Deposit — ${property.nickname}`}
        description={`${addressOneLine(property.address)}. Record the scheme, protection and prescribed information. Statuses come from the compliance engine.`}
        actions={
          <Link href={`/properties/${property.id}/essentials`} className="text-sm font-medium text-brand-600 hover:underline">
            Essentials →
          </Link>
        }
      />
      <DepositWorkspace propertyId={property.id} deposit={deposit} obligations={obligations} />
    </>
  );
}
