"use client";

import { useEffect, useState, type ReactNode } from "react";
import { trpc } from "@/lib/trpc/client";
import { Card, CardHeader, CardBody, Button, Select } from "@/components/ds";
import { ComplianceStatusChip } from "./ComplianceStatusChip";

type DwellingType = "flat" | "house" | "bedsit" | "hmo" | "other";

interface Form {
  propertyType: DwellingType | null;
  occupants: number | null;
  households: number | null;
  hasGasSupply: boolean;
  selectiveLicensingArea: boolean;
  annualRentGBP: number | null;
  tenantIsIndividual: boolean;
  tenantOnlyOrMainHome: boolean;
  landlordResident: boolean;
}

/** Monospace face for dates, citations, reference numbers and money. */
function Mono({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <span className={`font-mono ${className}`}>{children}</span>;
}

export function EssentialsWorkspace({ propertyId }: { propertyId: string }) {
  const utils = trpc.useUtils();
  const query = trpc.essentials.get.useQuery({ propertyId });
  const save = trpc.essentials.save.useMutation();
  const [form, setForm] = useState<Form | null>(null);

  useEffect(() => {
    if (query.data) setForm(query.data.profile);
  }, [query.data]);

  // The computed view always reflects the last SAVED profile (not unsaved edits).
  const view = save.data ?? query.data;

  async function onSave() {
    if (!form) return;
    await save.mutateAsync({ propertyId, ...form });
    await utils.essentials.get.invalidate({ propertyId });
  }

  if (!form || !view) {
    return <div className="h-40 animate-pulse rounded-card bg-slate-100" />;
  }

  const set = <K extends keyof Form>(key: K, value: Form[K]) => setForm((f) => (f ? { ...f, [key]: value } : f));

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      {/* --- Applicability profile form --- */}
      <Card>
        <CardHeader title="Applicability profile" subtitle="Drives every compliance obligation below." />
        <CardBody>
          <div className="space-y-4">
            <Field label="Property type">
              <Select
                className="w-full"
                value={form.propertyType ?? ""}
                onChange={(e) => set("propertyType", (e.target.value || null) as DwellingType | null)}
                options={[
                  { value: "", label: "—" },
                  { value: "flat", label: "Flat" },
                  { value: "house", label: "House" },
                  { value: "bedsit", label: "Bedsit" },
                  { value: "hmo", label: "HMO" },
                  { value: "other", label: "Other" },
                ]}
              />
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Occupants">
                <NumberInput value={form.occupants} onChange={(n) => set("occupants", n)} />
              </Field>
              <Field label="Households">
                <NumberInput value={form.households} onChange={(n) => set("households", n)} />
              </Field>
            </div>

            <Field label="Annual rent (£/yr)">
              <NumberInput value={form.annualRentGBP} onChange={(n) => set("annualRentGBP", n)} mono />
            </Field>

            <CheckRow label="Has a gas supply" checked={form.hasGasSupply} onChange={(b) => set("hasGasSupply", b)} />
            <CheckRow label="In a selective-licensing area" checked={form.selectiveLicensingArea} onChange={(b) => set("selectiveLicensingArea", b)} />

            <div className="h-px bg-slate-100" />
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Renters&apos; Rights Act inputs</p>
            <CheckRow label="Tenant is an individual" checked={form.tenantIsIndividual} onChange={(b) => set("tenantIsIndividual", b)} />
            <CheckRow label="Property is the tenant's only or main home" checked={form.tenantOnlyOrMainHome} onChange={(b) => set("tenantOnlyOrMainHome", b)} />
            <CheckRow label="Landlord is resident in the dwelling" checked={form.landlordResident} onChange={(b) => set("landlordResident", b)} />

            <div className="flex items-center gap-3 pt-1">
              <Button onClick={onSave} disabled={save.isPending}>
                {save.isPending ? "Saving…" : "Save & recompute"}
              </Button>
              {save.isSuccess ? <span className="text-sm text-slate-500">Saved — obligations recomputed.</span> : null}
            </div>
          </div>
        </CardBody>
      </Card>

      {/* --- Results --- */}
      <div className="space-y-6">
        {/* In-scope test */}
        <Card>
          <CardHeader title="In scope of the Renters' Rights Act?" />
          <CardBody>
            <div className="flex items-center gap-2">
              <span className="text-lg font-semibold text-slate-900">{view.scope.inScope ? "Yes" : "No"}</span>
              <span className="text-sm text-slate-500">{view.scope.summary}</span>
            </div>
            <ul className="mt-3 space-y-1.5 text-sm">
              {view.scope.conditions.map((c) => (
                <li key={c.id} className="flex items-start gap-2">
                  <Glyph pass={c.pass} />
                  <span className="text-slate-700">
                    {c.label} — <Mono className="text-slate-500">{c.detail}</Mono>
                  </span>
                </li>
              ))}
            </ul>
            <Citation text={view.scope.citation} />
          </CardBody>
        </Card>

        {/* HMO test */}
        <Card>
          <CardHeader title="Is this an HMO?" />
          <CardBody>
            <div className="flex items-center gap-2">
              <span className="text-lg font-semibold text-slate-900">{view.hmo.isHmo ? "Yes" : "No"}</span>
              <span className="text-sm text-slate-500">{view.hmo.summary}</span>
            </div>
            <p className="mt-2 text-sm text-slate-600">
              <Mono>{view.hmo.occupants}</Mono> occupant(s) across <Mono>{view.hmo.households}</Mono> household(s); the
              mandatory threshold is <Mono>5</Mono> across <Mono>2</Mono>.
            </p>
            <Citation text={view.hmo.citation} />
          </CardBody>
        </Card>

        {/* Obligations */}
        <Card>
          <CardHeader title="Obligations" subtitle="Status is computed by the engine from evidence and time." />
          <CardBody>
            <ul className="divide-y divide-slate-100">
              {view.evaluation.map((o) => (
                <li key={o.ruleId} className="flex items-start justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-slate-800">{o.title}</span>
                      <Mono className="text-[11px] text-slate-400">{o.ruleId}</Mono>
                    </div>
                    <p className="mt-0.5 text-sm text-slate-500">{o.basis.summary}</p>
                    <Citation text={o.citation} />
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <ComplianceStatusChip status={o.status} />
                    {o.dueDate ? <Mono className="text-xs text-slate-500">due {o.dueDate}</Mono> : null}
                  </div>
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}

// --- Small presentational helpers (no red/amber/green outside status chips) ---

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-slate-700">{label}</span>
      {children}
    </label>
  );
}

function NumberInput({ value, onChange, mono = false }: { value: number | null; onChange: (n: number | null) => void; mono?: boolean }) {
  return (
    <input
      type="number"
      min={0}
      className={`input ${mono ? "font-mono" : ""}`}
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))}
    />
  );
}

function CheckRow({ label, checked, onChange }: { label: string; checked: boolean; onChange: (b: boolean) => void }) {
  return (
    <label className="flex items-center gap-2.5 text-sm text-slate-700">
      <input type="checkbox" className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      {label}
    </label>
  );
}

/** Neutral pass/fail glyph — deliberately NOT green/red (reserved for status). */
function Glyph({ pass }: { pass: boolean }) {
  return (
    <span aria-hidden className="mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[11px] font-bold text-slate-600">
      {pass ? "✓" : "✕"}
    </span>
  );
}

function Citation({ text }: { text: string }) {
  return <p className="mt-1.5 font-mono text-[11px] leading-snug text-slate-400">{text}</p>;
}
