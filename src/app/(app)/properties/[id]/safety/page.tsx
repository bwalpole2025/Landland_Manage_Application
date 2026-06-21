import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { PageHeader } from "@/components/ui";
import { SafetyWorkspace, type SafetyItem } from "@/components/safety/SafetyWorkspace";
import { getSession } from "@/server/auth/session";
import { prisma } from "@/server/db";
import { getProperty } from "@/services/repository";
import { evaluateProperty } from "@/server/compliance/evaluate";
import { listEvidence } from "@/server/documents/service";
import { getStoragePort } from "@/server/storage";
import { addressOneLine } from "@/lib/labels";
import type { EvidenceKind } from "@prisma/client";

export const dynamic = "force-dynamic";

// The four safety certificates, in display order, and the evidence kind each
// obligation is satisfied by.
const SAFETY: { ruleId: string; kind: EvidenceKind }[] = [
  { ruleId: "gas-safety", kind: "GAS_SAFETY" },
  { ruleId: "eicr", kind: "EICR" },
  { ruleId: "epc", kind: "EPC" },
  { ruleId: "smoke-co-alarm", kind: "SMOKE_CO_ALARM" },
];

export default async function SafetyPage({ params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) redirect("/login");

  const property = getProperty(params.id);
  if (!property) notFound();

  // EVERY status and dueDate comes from the engine — nothing is computed here.
  const [{ evaluation }, evidence] = await Promise.all([
    evaluateProperty(prisma, session.account.id, property.id),
    listEvidence(prisma, getStoragePort(), { accountId: session.account.id, propertyId: property.id }),
  ]);

  const items: SafetyItem[] = SAFETY.map(({ ruleId, kind }) => {
    const obligation = evaluation.find((o) => o.ruleId === ruleId);
    return {
      ruleId,
      kind,
      title: obligation?.title ?? ruleId,
      citation: obligation?.citation ?? "",
      status: obligation?.status ?? "not_applicable",
      dueDate: obligation?.dueDate ?? null, // straight from the engine
      why: obligation?.basis.summary ?? "",
      evidence: evidence.filter((e) => e.kind === kind),
    };
  });

  return (
    <>
      <PageHeader
        title={`Safety certificates — ${property.nickname}`}
        description={`${addressOneLine(property.address)}. Status and next-due dates are read directly from the compliance engine. Upload each certificate and confirm its dates.`}
        actions={
          <Link href={`/properties/${property.id}/essentials`} className="text-sm font-medium text-brand-600 hover:underline">
            Essentials →
          </Link>
        }
      />
      <SafetyWorkspace propertyId={property.id} items={items} />
    </>
  );
}
