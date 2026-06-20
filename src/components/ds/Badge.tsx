import type { ReactNode } from "react";
import { cn, type Tone } from "./util";

const tones: Record<Tone, string> = {
  brand: "bg-brand-100 text-brand-800 ring-brand-200",
  accent: "bg-accent-100 text-accent-800 ring-accent-200",
  neutral: "bg-slate-100 text-slate-700 ring-slate-200",
  success: "bg-success-100 text-success-800 ring-success-200",
  warning: "bg-warning-100 text-warning-800 ring-warning-200",
  danger: "bg-danger-100 text-danger-800 ring-danger-200",
};

export function Badge({
  tone = "neutral",
  children,
  className,
}: {
  tone?: Tone;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-pill px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset",
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
