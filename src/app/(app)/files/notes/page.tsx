import { NotesScreen } from "@/components/files/NotesScreen";
import { getAggregatedNotes } from "@/lib/notes";
import { getProperties, getTenancies } from "@/services/repository";

export const dynamic = "force-dynamic";

export default function NotesPage() {
  const properties = getProperties().map((p) => ({ id: p.id, name: p.nickname }));
  const tenants = getTenancies().map((t) => ({ id: t.id, name: t.tenants[0]?.name ?? "Tenant" }));

  return <NotesScreen notes={getAggregatedNotes()} properties={properties} tenants={tenants} />;
}
