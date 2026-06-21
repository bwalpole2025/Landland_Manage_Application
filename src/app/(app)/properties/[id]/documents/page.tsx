import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { PageHeader } from "@/components/ui";
import { DocumentsWorkspace } from "@/components/documents/DocumentsWorkspace";
import { getSession } from "@/server/auth/session";
import { prisma } from "@/server/db";
import { getProperty } from "@/services/repository";
import { listEvidence } from "@/server/documents/service";
import { getStoragePort } from "@/server/storage";
import { addressOneLine } from "@/lib/labels";

export const dynamic = "force-dynamic";

export default async function DocumentsPage({ params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) redirect("/login");

  const property = getProperty(params.id);
  if (!property) notFound();

  const evidence = await listEvidence(prisma, getStoragePort(), {
    accountId: session.account.id,
    propertyId: property.id,
  });

  return (
    <>
      <PageHeader
        title={`Documents — ${property.nickname}`}
        description={`${addressOneLine(property.address)}. Upload compliance certificates. An expiry date you enter (or that OCR extracts) is a proposal until you confirm it — only a confirmed date becomes the deadline the engine reads.`}
        actions={
          <Link href={`/properties/${property.id}/essentials`} className="text-sm font-medium text-brand-600 hover:underline">
            Essentials →
          </Link>
        }
      />
      <DocumentsWorkspace propertyId={property.id} initialEvidence={evidence} />
    </>
  );
}
