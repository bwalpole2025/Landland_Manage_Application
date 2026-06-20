import { PageHeader, Card, CardHeader, Badge } from "@/components/ui";
import { getProperties, getUser } from "@/services/repository";
import { addressOneLine } from "@/lib/labels";

export default function OwnershipPage() {
  const properties = getProperties();
  return (
    <>
      <PageHeader
        title="Ownership"
        description="Beneficial ownership splits across your properties — used for pro-rata tax apportionment."
      />
      <div className="space-y-4">
        {properties.map((p) => (
          <Card key={p.id}>
            <CardHeader title={p.nickname} subtitle={addressOneLine(p.address)} />
            <ul className="divide-y divide-slate-100">
              {p.ownership.map((o) => {
                const user = getUser(o.userId);
                return (
                  <li key={o.userId} className="flex items-center justify-between px-5 py-3 text-sm">
                    <span className="font-medium text-slate-800">{user?.name ?? o.userId}</span>
                    <Badge tone="brand">{o.share}%</Badge>
                  </li>
                );
              })}
            </ul>
          </Card>
        ))}
      </div>
    </>
  );
}
