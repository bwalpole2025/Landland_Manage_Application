import { SectionCoachmark } from "@/components/coachmarks/SectionCoachmark";
import { TenanciesScreen, type TenancyRowData } from "@/components/properties/TenanciesScreen";
import { getProperties } from "@/services/repository";
import { getTenancyRows } from "@/lib/tenancies";
import { getPropertiesSummary } from "@/lib/properties";
import { addressOneLine } from "@/lib/labels";

export const dynamic = "force-dynamic";

export default function TenanciesPage() {
  const rows: TenancyRowData[] = getTenancyRows();
  const properties = getProperties().map((p) => ({ id: p.id, name: p.nickname, address: addressOneLine(p.address) }));

  return (
    <>
      <SectionCoachmark section="tenancies" />
      <TenanciesScreen summary={getPropertiesSummary()} rows={rows} properties={properties} />
    </>
  );
}
