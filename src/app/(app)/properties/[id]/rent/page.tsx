import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { PageHeader } from "@/components/ui";
import { RentWorkspace } from "@/components/rent/RentWorkspace";
import { getSession } from "@/server/auth/session";
import { prisma } from "@/server/db";
import { getProperty } from "@/services/repository";
import { assessRentForProperty } from "@/server/compliance/rent";
import { addressOneLine } from "@/lib/labels";
import { todayISO } from "@/lib/dates";
import { now } from "@/lib/clock";

export const dynamic = "force-dynamic";

export default async function RentPage({ params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) redirect("/login");

  const property = getProperty(params.id);
  if (!property) notFound();

  const view = await assessRentForProperty(prisma, session.account.id, property.id, { asOf: todayISO(now()) });

  return (
    <>
      <PageHeader
        title={`Rent — ${property.nickname}`}
        description={`${addressOneLine(property.address)}. Expected schedule versus received payments, with an engine-derived arrears state. Manual entry for now; bank-feed reconciliation will add confirmed receipts later.`}
        actions={
          <Link href={`/properties/${property.id}/essentials`} className="text-sm font-medium text-brand-600 hover:underline">
            Essentials →
          </Link>
        }
      />
      <RentWorkspace
        propertyId={property.id}
        schedule={view.schedule}
        receipts={view.receipts}
        assessment={view.assessment}
      />
    </>
  );
}
