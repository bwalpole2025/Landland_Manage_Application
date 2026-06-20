"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card, CardHeader, Badge, Button } from "@/components/ui";
import { Modal } from "@/components/ds/Modal";
import { Tabs } from "@/components/ds/Tabs";
import { formatDate, expiryUrgency } from "@/lib/dates";
import { createReminderAction, completeReminderAction, reopenReminderAction, clearCompletedRemindersAction } from "@/app/(app)/files/reminders/actions";

export interface ReminderRow {
  id: string;
  name: string;
  description?: string;
  dueDate: string;
  status: "open" | "completed";
  propertyId?: string;
  tenancyId?: string;
}

export interface RemindersScreenProps {
  reminders: ReminderRow[];
  properties: { id: string; name: string }[];
  tenancies: { id: string; label: string; propertyId: string }[];
}

const field = "h-10 w-full appearance-none rounded-lg border border-slate-300 px-3 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100";
const fieldLabel = "mb-1 block text-sm font-medium text-slate-700";

export function RemindersScreen({ reminders: initial, properties, tenancies }: RemindersScreenProps) {
  const router = useRouter();
  const [, start] = useTransition();
  const [rows, setRows] = useState<ReminderRow[]>(initial);
  const [tab, setTab] = useState("work");
  const [addOpen, setAddOpen] = useState(false);

  const open = useMemo(() => rows.filter((r) => r.status === "open").sort((a, b) => (a.dueDate < b.dueDate ? -1 : 1)), [rows]);
  const completed = useMemo(() => rows.filter((r) => r.status === "completed"), [rows]);
  const list = tab === "work" ? open : completed;

  function complete(id: string) {
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, status: "completed" as const } : r)));
    start(async () => { await completeReminderAction(id); router.refresh(); });
  }
  function reopen(id: string) {
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, status: "open" as const } : r)));
    start(async () => { await reopenReminderAction(id); router.refresh(); });
  }
  function clearCompleted() {
    setRows((rs) => rs.filter((r) => r.status !== "completed"));
    start(async () => { await clearCompletedRemindersAction(); router.refresh(); });
  }
  function add(row: ReminderRow) {
    setRows((rs) => [row, ...rs]);
  }

  return (
    <>
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Reminders</h1>
          <p className="mt-1 text-sm text-slate-500">Your to-dos with due dates — renewals, chases and deadlines.</p>
        </div>
        <Button onClick={() => setAddOpen(true)}>New reminder</Button>
      </div>

      <div className="flex items-center justify-between gap-3">
        <Tabs value={tab} onChange={setTab} items={[{ id: "work", label: "My work", badge: open.length }, { id: "completed", label: "Completed", badge: completed.length }]} />
        {tab === "completed" && completed.length > 0 ? (
          <button onClick={clearCompleted} className="text-sm font-medium text-red-600 hover:text-red-700">Clear</button>
        ) : null}
      </div>

      <Card>
        {list.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
            <span className="text-4xl" role="img" aria-label="done">✅</span>
            <p className="mt-3 text-sm font-medium text-slate-900">{tab === "work" ? "All up to date!" : "Nothing completed yet"}</p>
            <p className="mt-1 text-sm text-slate-500">{tab === "work" ? "New reminders you create will show here." : "Completed reminders move here."}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-400">
                  <th className="px-5 py-3 font-medium">Due Date</th>
                  <th className="px-5 py-3 font-medium">Name</th>
                  <th className="px-5 py-3 font-medium">Description</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                  <th className="px-5 py-3 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {list.map((r) => {
                  const overdue = r.status === "open" && expiryUrgency(r.dueDate).urgency === "expired";
                  return (
                    <tr key={r.id} className="hover:bg-slate-50">
                      <td className="whitespace-nowrap px-5 py-3 text-slate-600">{formatDate(r.dueDate)}</td>
                      <td className="px-5 py-3 font-medium text-slate-900">{r.name}</td>
                      <td className="px-5 py-3 text-slate-600">{r.description ?? "—"}</td>
                      <td className="px-5 py-3">
                        {r.status === "completed" ? <Badge tone="success">Completed</Badge> : overdue ? <Badge tone="danger">Overdue</Badge> : <Badge tone="warning">Open</Badge>}
                      </td>
                      <td className="px-5 py-3 text-right">
                        {r.status === "open" ? (
                          <button onClick={() => complete(r.id)} className="text-sm font-medium text-brand-700 hover:text-brand-800">Mark complete</button>
                        ) : (
                          <button onClick={() => reopen(r.id)} className="text-sm font-medium text-slate-500 hover:text-slate-700">Reopen</button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <NewReminderModal open={addOpen} onClose={() => setAddOpen(false)} properties={properties} tenancies={tenancies} onCreated={add} />
    </>
  );
}

function NewReminderModal({ open, onClose, properties, tenancies, onCreated }: { open: boolean; onClose: () => void; properties: { id: string; name: string }[]; tenancies: { id: string; label: string; propertyId: string }[]; onCreated: (r: ReminderRow) => void }) {
  const router = useRouter();
  const [, start] = useTransition();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [propertyId, setPropertyId] = useState("");
  const [tenancyId, setTenancyId] = useState("");
  const [error, setError] = useState<string | null>(null);

  const tenancyOpts = tenancies.filter((t) => !propertyId || t.propertyId === propertyId);

  function submit() {
    setError(null);
    if (!name.trim()) return setError("Give the reminder a name.");
    if (!dueDate) return setError("Choose a due date.");
    onCreated({ id: `rem_local_${Date.now()}`, name: name.trim(), description: description.trim() || undefined, dueDate, status: "open", propertyId: propertyId || undefined, tenancyId: tenancyId || undefined });
    start(async () => {
      await createReminderAction({ name: name.trim(), description: description.trim() || undefined, dueDate, propertyId: propertyId || undefined, tenancyId: tenancyId || undefined });
      router.refresh();
    });
    setName(""); setDescription(""); setDueDate(""); setPropertyId(""); setTenancyId("");
    onClose();
  }

  return (
    <Modal open={open} onClose={onClose} title="New reminder" size="md"
      footer={<div className="flex w-full justify-end gap-2"><Button variant="secondary" onClick={onClose}>Cancel</Button><Button onClick={submit}>Create reminder</Button></div>}>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="block sm:col-span-2"><span className={fieldLabel}>Name</span><input className={field} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Renew gas safety certificate" /></label>
        <label className="block sm:col-span-2"><span className={fieldLabel}>Description</span><input className={field} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Optional details" /></label>
        <label className="block"><span className={fieldLabel}>Due date</span><input type="date" className={field} value={dueDate} onChange={(e) => setDueDate(e.target.value)} /></label>
        <label className="block"><span className={fieldLabel}>Property (optional)</span>
          <select className={field} value={propertyId} onChange={(e) => { setPropertyId(e.target.value); setTenancyId(""); }}>
            <option value="">None</option>
            {properties.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </label>
        <label className="block sm:col-span-2"><span className={fieldLabel}>Tenancy (optional)</span>
          <select className={field} value={tenancyId} onChange={(e) => setTenancyId(e.target.value)}>
            <option value="">None</option>
            {tenancyOpts.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
          </select>
        </label>
      </div>
      {error ? <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}
    </Modal>
  );
}
