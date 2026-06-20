"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui";
import { formatGBP } from "@/lib/money";
import type { CalendarEvent, CalendarEventType } from "@/lib/calendar";

const TYPE_STYLE: Record<CalendarEventType, string> = {
  payment: "bg-emerald-100 text-emerald-800 ring-emerald-200 hover:bg-emerald-200",
  expiry: "bg-amber-100 text-amber-800 ring-amber-200 hover:bg-amber-200",
  reminder: "bg-sky-100 text-sky-800 ring-sky-200 hover:bg-sky-200",
  account: "bg-violet-100 text-violet-800 ring-violet-200 hover:bg-violet-200",
};
const TYPE_DOT: Record<CalendarEventType, string> = { payment: "bg-emerald-500", expiry: "bg-amber-500", reminder: "bg-sky-500", account: "bg-violet-500" };
const TYPE_LABEL: Record<CalendarEventType, string> = { payment: "Upcoming Payment", expiry: "Document expiry", reminder: "Reminder", account: "Account event" };
const ALL_TYPES: CalendarEventType[] = ["payment", "expiry", "reminder", "account"];
const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

// --- date utils (operate on date-only ISO in UTC to keep the grid stable) ---
const pad = (n: number) => String(n).padStart(2, "0");
const ymd = (iso: string) => { const [y, m, d] = iso.split("-").map(Number); return { y, m, d }; };
const isoOf = (y: number, m: number, d: number) => `${y}-${pad(m)}-${pad(d)}`;
const toDate = (iso: string) => new Date(`${iso}T00:00:00Z`);
const toISO = (d: Date) => d.toISOString().slice(0, 10);
function addDays(iso: string, n: number) { const d = toDate(iso); d.setUTCDate(d.getUTCDate() + n); return toISO(d); }
function addMonths(iso: string, n: number) { const { y, m, d } = ymd(iso); const total = (m - 1) + n; const ny = y + Math.floor(total / 12); const nm = ((total % 12) + 12) % 12; const last = new Date(Date.UTC(ny, nm + 1, 0)).getUTCDate(); return isoOf(ny, nm + 1, Math.min(d, last)); }
const startOfMonth = (iso: string) => { const { y, m } = ymd(iso); return isoOf(y, m, 1); };
const weekdayMon = (iso: string) => (toDate(iso).getUTCDay() + 6) % 7; // 0=Mon..6=Sun
function startOfWeek(iso: string) { return addDays(iso, -weekdayMon(iso)); }
const monthYearLabel = (iso: string) => { const { y, m } = ymd(iso); return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" }); };
const fullDateLabel = (iso: string) => toDate(iso).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });

type View = "month" | "week" | "day";

export function CalendarView({ events, today }: { events: CalendarEvent[]; today: string }) {
  const [view, setView] = useState<View>("month");
  const [cursor, setCursor] = useState(today);
  const [types, setTypes] = useState<Set<CalendarEventType>>(new Set(ALL_TYPES));
  const [filterOpen, setFilterOpen] = useState(false);
  const filterRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onAway(e: MouseEvent) { if (filterRef.current && !filterRef.current.contains(e.target as Node)) setFilterOpen(false); }
    document.addEventListener("mousedown", onAway);
    return () => document.removeEventListener("mousedown", onAway);
  }, []);

  const byDate = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const e of events) {
      if (!types.has(e.type)) continue;
      const list = map.get(e.date);
      if (list) list.push(e);
      else map.set(e.date, [e]);
    }
    return map;
  }, [events, types]);

  function shift(dir: -1 | 1) {
    setCursor((c) => (view === "month" ? addMonths(c, dir) : view === "week" ? addDays(c, dir * 7) : addDays(c, dir)));
  }

  const header = view === "month" ? monthYearLabel(cursor) : view === "week" ? weekHeader(cursor) : fullDateLabel(cursor);

  return (
    <>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Calendar</h1>
        <p className="mt-1 text-sm text-slate-500">Rent payments, document expiries, reminders and account events across your portfolio.</p>
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button onClick={() => setCursor(today)} className="h-9 rounded-pill px-3 text-sm font-medium text-slate-700 ring-1 ring-inset ring-slate-300 hover:bg-slate-50">Today</button>
          <div className="flex items-center">
            <button onClick={() => shift(-1)} aria-label="Previous" className="flex h-9 w-9 items-center justify-center rounded-l-lg ring-1 ring-inset ring-slate-300 hover:bg-slate-50">‹</button>
            <button onClick={() => shift(1)} aria-label="Next" className="-ml-px flex h-9 w-9 items-center justify-center rounded-r-lg ring-1 ring-inset ring-slate-300 hover:bg-slate-50">›</button>
          </div>
          <h2 className="ml-1 text-lg font-semibold text-slate-900">{header}</h2>
        </div>

        <div className="flex items-center gap-2">
          {/* Filter control */}
          <div className="relative" ref={filterRef}>
            <button onClick={() => setFilterOpen((o) => !o)} aria-expanded={filterOpen} className="inline-flex h-9 items-center gap-1.5 rounded-pill px-3 text-sm font-medium text-slate-700 ring-1 ring-inset ring-slate-300 hover:bg-slate-50">
              Filter{types.size < ALL_TYPES.length ? <span className="rounded-full bg-brand-100 px-1.5 text-xs text-brand-700">{types.size}</span> : null}
            </button>
            {filterOpen ? (
              <div className="absolute right-0 top-full z-50 mt-1 w-56 rounded-xl border border-slate-200 bg-white p-2 shadow-lg">
                {ALL_TYPES.map((t) => (
                  <label key={t} className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-slate-50">
                    <input type="checkbox" className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500" checked={types.has(t)}
                      onChange={() => setTypes((s) => { const n = new Set(s); n.has(t) ? n.delete(t) : n.add(t); return n; })} />
                    <span className={`h-2.5 w-2.5 rounded-full ${TYPE_DOT[t]}`} />
                    <span className="text-slate-700">{TYPE_LABEL[t]}</span>
                  </label>
                ))}
              </div>
            ) : null}
          </div>

          {/* View switch */}
          <div className="flex rounded-pill ring-1 ring-inset ring-slate-300">
            {(["month", "week", "day"] as View[]).map((v) => (
              <button key={v} onClick={() => setView(v)} className={`h-9 px-3 text-sm font-medium capitalize first:rounded-l-pill last:rounded-r-pill ${view === v ? "bg-brand-600 text-white" : "text-slate-600 hover:bg-slate-50"}`}>{v}</button>
            ))}
          </div>
        </div>
      </div>

      {view === "month" ? <MonthGrid cursor={cursor} today={today} byDate={byDate} /> : null}
      {view === "week" ? <WeekView cursor={cursor} today={today} byDate={byDate} /> : null}
      {view === "day" ? <DayView cursor={cursor} byDate={byDate} /> : null}

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500">
        {ALL_TYPES.map((t) => <span key={t} className="flex items-center gap-1.5"><span className={`h-2.5 w-2.5 rounded-full ${TYPE_DOT[t]}`} />{TYPE_LABEL[t]}</span>)}
      </div>
    </>
  );
}

function weekHeader(cursor: string) {
  const start = startOfWeek(cursor);
  const end = addDays(start, 6);
  const s = ymd(start), e = ymd(end);
  const sLabel = toDate(start).toLocaleDateString("en-GB", { day: "numeric", month: s.m === e.m ? undefined : "short", timeZone: "UTC" });
  const eLabel = toDate(end).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
  return `${sLabel} – ${eLabel}`;
}

function Chip({ event }: { event: CalendarEvent }) {
  const router = useRouter();
  return (
    <button
      onClick={() => router.push(event.href)}
      title={`${event.title}${event.subtitle ? ` · ${event.subtitle}` : ""}`}
      className={`block w-full truncate rounded px-1.5 py-0.5 text-left text-[11px] font-medium ring-1 ring-inset ${TYPE_STYLE[event.type]}`}
    >
      {event.type === "payment" && event.amountPence != null ? `${event.title} · ${formatGBP(event.amountPence, { showPence: false })}` : event.title}
    </button>
  );
}

function MonthGrid({ cursor, today, byDate }: { cursor: string; today: string; byDate: Map<string, CalendarEvent[]> }) {
  const gridStart = addDays(startOfMonth(cursor), -weekdayMon(startOfMonth(cursor)));
  const days = Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));
  const month = ymd(cursor).m;
  return (
    <Card className="overflow-hidden">
      <div className="grid grid-cols-7 border-b border-slate-100 bg-slate-50 text-center text-xs font-semibold uppercase tracking-wide text-slate-400">
        {WEEKDAYS.map((d) => <div key={d} className="py-2">{d}</div>)}
      </div>
      <div className="grid grid-cols-7">
        {days.map((d) => {
          const inMonth = ymd(d).m === month;
          const isToday = d === today;
          const dayEvents = byDate.get(d) ?? [];
          return (
            <div key={d} className={`min-h-[104px] border-b border-r border-slate-100 p-1.5 ${inMonth ? "" : "bg-slate-50/50"}`}>
              <div className="mb-1 flex justify-end">
                <span className={`flex h-6 w-6 items-center justify-center rounded-full text-xs ${isToday ? "bg-brand-600 font-bold text-white" : inMonth ? "text-slate-600" : "text-slate-300"}`}>{ymd(d).d}</span>
              </div>
              <div className="space-y-1">
                {dayEvents.slice(0, 3).map((e) => <Chip key={e.id} event={e} />)}
                {dayEvents.length > 3 ? <p className="px-1 text-[11px] text-slate-400">+{dayEvents.length - 3} more</p> : null}
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

function WeekView({ cursor, today, byDate }: { cursor: string; today: string; byDate: Map<string, CalendarEvent[]> }) {
  const start = startOfWeek(cursor);
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));
  return (
    <Card className="overflow-hidden">
      <div className="grid grid-cols-7">
        {days.map((d) => {
          const isToday = d === today;
          const dayEvents = byDate.get(d) ?? [];
          return (
            <div key={d} className="min-h-[260px] border-r border-slate-100 p-2 last:border-r-0">
              <div className="mb-2 text-center">
                <p className="text-xs uppercase tracking-wide text-slate-400">{WEEKDAYS[weekdayMon(d)]}</p>
                <p className={`mx-auto mt-0.5 flex h-7 w-7 items-center justify-center rounded-full text-sm ${isToday ? "bg-brand-600 font-bold text-white" : "text-slate-700"}`}>{ymd(d).d}</p>
              </div>
              <div className="space-y-1">{dayEvents.map((e) => <Chip key={e.id} event={e} />)}</div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

function DayView({ cursor, byDate }: { cursor: string; byDate: Map<string, CalendarEvent[]> }) {
  const router = useRouter();
  const dayEvents = byDate.get(cursor) ?? [];
  return (
    <Card>
      {dayEvents.length === 0 ? (
        <div className="px-6 py-16 text-center text-sm text-slate-500">Nothing scheduled for {fullDateLabel(cursor)}.</div>
      ) : (
        <ul className="divide-y divide-slate-100">
          {dayEvents.map((e) => (
            <li key={e.id}>
              <button onClick={() => router.push(e.href)} className="flex w-full items-center gap-3 px-5 py-3 text-left hover:bg-slate-50">
                <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${TYPE_DOT[e.type]}`} />
                <span className="min-w-0 flex-1"><span className="block text-sm font-medium text-slate-900">{e.title}</span>{e.subtitle ? <span className="block text-xs text-slate-500">{e.subtitle}</span> : null}</span>
                {e.amountPence != null ? <span className="text-sm font-semibold text-slate-700">{formatGBP(e.amountPence, { showPence: false })}</span> : <span className="text-xs uppercase tracking-wide text-slate-400">{TYPE_LABEL[e.type]}</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
