import { PageHeader, Card, CardHeader, Badge } from "@/components/ui";
import { getTenancies, getProperty, getTransactions } from "@/services/repository";
import { computeArrears } from "@/lib/arrears";
import { formatGBP } from "@/lib/money";
import { formatDate } from "@/lib/dates";

export default function TenanciesPage() {
  const tenancies = getTenancies();
  const transactions = getTransactions();

  return (
    <>
      <PageHeader title="Tenancies" description="Every tenancy, its rent, status and arrears at a glance." />
      <Card>
        <CardHeader title="All tenancies" subtitle={`${tenancies.length} tenancies`} />
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-400">
                <th className="px-5 py-3 font-medium">Property</th>
                <th className="px-5 py-3 font-medium">Tenant</th>
                <th className="px-5 py-3 font-medium">Rent</th>
                <th className="px-5 py-3 font-medium">Since</th>
                <th className="px-5 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {tenancies.map((t) => {
                const property = getProperty(t.propertyId);
                const arrears = computeArrears(t, transactions);
                return (
                  <tr key={t.id} className="hover:bg-slate-50">
                    <td className="px-5 py-3 font-medium text-slate-900">{property?.nickname ?? "—"}</td>
                    <td className="px-5 py-3 text-slate-600">{t.tenants.map((x) => x.name).join(", ")}</td>
                    <td className="px-5 py-3 text-slate-600">
                      {formatGBP(t.rentPence, { showPence: false })} / {t.rentFrequency === "monthly" ? "mo" : "wk"}
                    </td>
                    <td className="px-5 py-3 text-slate-600">{formatDate(t.startDate)}</td>
                    <td className="px-5 py-3">
                      {arrears.status === "in_arrears" ? (
                        <Badge tone="danger">{formatGBP(arrears.balancePence, { showPence: false })} arrears</Badge>
                      ) : (
                        <Badge tone="success">Up to date</Badge>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}
