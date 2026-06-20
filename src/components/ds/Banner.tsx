"use client";

import { useState, type ReactNode } from "react";
import { cn } from "./util";

export type BannerTone = "info" | "success" | "warning" | "danger";

const toneStyles: Record<BannerTone, { box: string; icon: string; glyph: string }> = {
  info: { box: "border-brand-200 bg-brand-50 text-brand-900", icon: "text-brand-600", glyph: "ℹ" },
  success: { box: "border-success-200 bg-success-50 text-success-800", icon: "text-success-600", glyph: "✓" },
  warning: { box: "border-warning-200 bg-warning-50 text-warning-800", icon: "text-warning-600", glyph: "⚠" },
  danger: { box: "border-danger-200 bg-danger-50 text-danger-800", icon: "text-danger-600", glyph: "⚠" },
};

export interface BannerProps {
  tone?: BannerTone;
  title?: ReactNode;
  children?: ReactNode;
  action?: ReactNode;
  dismissible?: boolean;
}

/** Inline alert / banner. Use `warning` for trial banners, `danger` for overdue. */
export function Banner({ tone = "info", title, children, action, dismissible }: BannerProps) {
  const [open, setOpen] = useState(true);
  if (!open) return null;
  const s = toneStyles[tone];
  return (
    <div className={cn("flex items-start gap-3 rounded-lg border px-4 py-3 text-sm", s.box)}>
      <span aria-hidden className={cn("mt-0.5 select-none font-bold", s.icon)}>
        {s.glyph}
      </span>
      <div className="min-w-0 flex-1">
        {title ? <p className="font-semibold">{title}</p> : null}
        {children ? <div className={cn(title ? "mt-0.5" : undefined)}>{children}</div> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
      {dismissible ? (
        <button
          onClick={() => setOpen(false)}
          aria-label="Dismiss"
          className="shrink-0 rounded p-0.5 text-current/60 hover:bg-black/5"
        >
          ✕
        </button>
      ) : null}
    </div>
  );
}
