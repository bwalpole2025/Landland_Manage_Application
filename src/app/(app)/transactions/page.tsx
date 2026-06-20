import { SectionCoachmark } from "@/components/coachmarks/SectionCoachmark";
import { TransactionsWorkspace } from "@/components/transactions/TransactionsWorkspace";
import type { LedgerOption } from "@/components/transactions/TransactionsLedger";
import {
  getActiveTenancyForProperty,
  getBankAccounts,
  getProperties,
  getProperty,
  getTenancies,
  getTransactions,
} from "@/services/repository";
import type { SuggestContext } from "@/lib/categorisation";

export const dynamic = "force-dynamic";

export default function TransactionsPage() {
  const properties = getProperties();
  const propertyNames = Object.fromEntries(properties.map((p) => [p.id, p.nickname]));
  const all = getTransactions();
  const tenanciesAll = getTenancies();

  const propertyOptions: LedgerOption[] = properties.map((p) => ({ id: p.id, label: p.nickname }));
  const tenancyOptions: LedgerOption[] = tenanciesAll.map((t) => ({
    id: t.id,
    label: `${t.tenants[0]?.name ?? "Tenant"} · ${getProperty(t.propertyId)?.nickname ?? ""}`,
  }));
  const tenancyNames = Object.fromEntries(tenancyOptions.map((t) => [t.id, t.label]));

  const activeTenancies = properties
    .map((p) => getActiveTenancyForProperty(p.id))
    .filter((t): t is NonNullable<typeof t> => t != null);
  const activeTenancyByProperty = Object.fromEntries(activeTenancies.map((t) => [t.propertyId, t.id]));

  const suggestContext: SuggestContext = {
    properties: properties.map((p) => ({ id: p.id, nickname: p.nickname })),
    tenancies: tenanciesAll.map((t) => ({
      id: t.id,
      propertyId: t.propertyId,
      tenantNames: t.tenants.map((x) => x.name),
      rentPence: t.rentPence,
    })),
  };

  return (
    <>
      <SectionCoachmark section="transactions" />
      <TransactionsWorkspace
        initialRows={all}
        initialAccounts={getBankAccounts()}
        propertyNames={propertyNames}
        tenancyNames={tenancyNames}
        properties={propertyOptions}
        tenancies={tenancyOptions}
        activeTenancies={activeTenancies}
        activeTenancyByProperty={activeTenancyByProperty}
        suggestContext={suggestContext}
      />
    </>
  );
}
