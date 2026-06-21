import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { PageHeader } from "@/components/ui";
import { EssentialsWorkspace } from "@/components/essentials/EssentialsWorkspace";
import { getSession } from "@/server/auth/session";
import { getProperty } from "@/services/repository";
import { addressOneLine } from "@/lib/labels";

export const dynamic = "force-dynamic";

export default async function EssentialsPage({ params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) redirect("/login");

  const property = getProperty(params.id);
  if (!property) notFound();

  return (
    <>
      <PageHeader
        title={`Essentials — ${property.nickname}`}
        description={`${addressOneLine(property.address)}. This section gates every other compliance area: set the applicability profile, then review the obligations it produces.`}
        actions={
          <Link href={`/properties/${property.id}`} className="text-sm font-medium text-brand-600 hover:underline">
            ← Back to property
          </Link>
        }
      />
      <EssentialsWorkspace propertyId={property.id} />
    </>
  );
}
