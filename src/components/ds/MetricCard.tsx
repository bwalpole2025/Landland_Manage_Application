import type { ReactNode } from "react";
import { cn, type Tone } from "./util";
import { Card } from "./Card";

const valueTone: Record<Tone, string> = {
  brand: "text-brand-700",
  accent: "text-accent-700",
  neutral: "text-slate-900",
  success: "text-success-700",
  warning: "text-warning-700",
  danger: "text-danger-700",
};

const deltaTone: Record<"up" | "down" | "flat", string> = {
  up: "text-success-700 bg-success-50",
  down: "text-danger-700 bg-danger-50",
  flat: "text-slate-600 bg-slate-100",
};

export interface MetricCardProps {
  /** Uppercase grey label. */
  label: string;
  /** Large bold value. */
  value: ReactNode;
  /** Optional supporting line beneath the value. */
  sub?: ReactNode;
  /** Optional accent for the value (e.g. danger for arrears). */
  tone?: Tone;
  /** Optional change indicator. */
  delta?: { direction: "up" | "down" | "flat"; label: string };
  icon?: ReactNode;
}

/** Metric tile: UPPERCASE grey label + large value, per the design language. */
export function MetricCard({ label, value, sub, tone = "neutral", delta, icon }: MetricCardProps) {
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-3">
        <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">{label}</span>
        {icon ? <span className="text-brand-500">{icon}</span> : null}
      </div>
      <div className="mt-2 flex items-end gap-2">
        <span className={cn("text-3xl font-bold tracking-tight", valueTone[tone])}>{value}</span>
        {delta ? (
          <span className={cn("mb-1 rounded-pill px-1.5 py-0.5 text-xs font-semibold", deltaTone[delta.direction])}>
            {delta.direction === "up" ? "▲" : delta.direction === "down" ? "▼" : "■"} {delta.label}
          </span>
        ) : null}
      </div>
      {sub ? <div className="mt-1 text-sm text-slate-500">{sub}</div> : null}
    </Card>
  );
}
