import { RemindersScreen, type ReminderRow } from "@/components/files/RemindersScreen";
import { getReminders, getProperties, getTenancies, getProperty } from "@/services/repository";

export const dynamic = "force-dynamic";

export default function RemindersPage() {
  const rows: ReminderRow[] = getReminders().map((r) => ({
    id: r.id,
    name: r.name,
    description: r.description,
    dueDate: r.dueDate,
    status: r.status,
    propertyId: r.propertyId,
    tenancyId: r.tenancyId,
  }));
  const properties = getProperties().map((p) => ({ id: p.id, name: p.nickname }));
  const tenancies = getTenancies().map((t) => ({ id: t.id, label: `${t.tenants[0]?.name ?? "Tenant"} · ${getProperty(t.propertyId)?.nickname ?? ""}`, propertyId: t.propertyId }));

  return <RemindersScreen reminders={rows} properties={properties} tenancies={tenancies} />;
}
