import Link from "next/link";
import type { ReactNode } from "react";
import { Card } from "@/components/ui";
import { LockIcon } from "@/components/icons";

export interface WidgetProps {
  title: string;
  subtitle?: ReactNode;
  action?: ReactNode;
  /** When true the body is dimmed and an unlock/prompt overlay is shown. */
  locked?: boolean;
  lockHeading?: string;
  lockMessage?: string;
  lockCtaLabel?: string;
  lockCtaHref?: string;
  className?: string;
  children: ReactNode;
}

/**
 * Shared dashboard widget card. Renders a header + body, and supports a locked
 * state that overlays the (blurred) body with an unlock prompt.
 */
export function Widget({
  title,
  subtitle,
  action,
  locked = false,
  lockHeading = "Unlock your data",
  lockMessage = "Track your transactions to unlock this insight.",
  lockCtaLabel = "Track transactions",
  lockCtaHref = "/transactions",
  className = "",
  children,
}: WidgetProps) {
  return (
    <Card className={`flex flex-col ${className}`}>
      <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-3.5">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
          {subtitle ? <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p> : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>

      <div className="relative flex-1">
        <div className={locked ? "pointer-events-none select-none blur-[3px]" : ""} aria-hidden={locked}>
          {children}
        </div>

        {locked ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-white/70 px-5 text-center backdrop-blur-[1px]">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-100 text-brand-700">
              <LockIcon width={20} height={20} />
            </span>
            <p className="text-xs font-bold uppercase tracking-wider text-brand-700">{lockHeading}</p>
            <p className="max-w-[14rem] text-sm text-slate-600">{lockMessage}</p>
            <Link
              href={lockCtaHref}
              className="mt-1 inline-flex items-center rounded-pill bg-brand-600 px-3.5 py-1.5 text-sm font-medium text-white transition hover:bg-brand-700"
            >
              {lockCtaLabel}
            </Link>
          </div>
        ) : null}
      </div>
    </Card>
  );
}

/** Centered muted message for unlocked-but-empty widget bodies. */
export function WidgetEmpty({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-full min-h-[7rem] flex-col items-center justify-center px-5 py-6 text-center text-sm text-slate-500">
      {children}
    </div>
  );
}

/** Label / value row used inside widgets. */
export function Metric({
  label,
  value,
  tone = "default",
}: {
  label: ReactNode;
  value: ReactNode;
  tone?: "default" | "positive" | "negative" | "muted";
}) {
  const valueClass =
    tone === "positive"
      ? "text-emerald-600"
      : tone === "negative"
        ? "text-red-600"
        : tone === "muted"
          ? "text-slate-400"
          : "text-slate-900";
  return (
    <div className="flex items-baseline justify-between gap-3 py-1">
      <span className="text-sm text-slate-500">{label}</span>
      <span className={`text-sm font-semibold tabular-nums ${valueClass}`}>{value}</span>
    </div>
  );
}

/** Thin labelled progress bar. */
export function Bar({ percent, tone = "brand" }: { percent: number; tone?: "brand" | "success" | "warning" }) {
  const fill = tone === "success" ? "bg-emerald-500" : tone === "warning" ? "bg-amber-500" : "bg-brand-500";
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
      <div className={`h-full rounded-full ${fill} transition-all`} style={{ width: `${Math.max(0, Math.min(100, percent))}%` }} />
    </div>
  );
}
