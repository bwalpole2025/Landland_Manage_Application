import type { ReactNode } from "react";
import { cn } from "./util";

export interface SidebarNavItemProps {
  label: ReactNode;
  icon: ReactNode;
  href?: string;
  active?: boolean;
  badge?: ReactNode;
  /** Override the rendered element (e.g. Next's Link) while keeping the styling. */
  as?: "a" | "button";
  onClick?: () => void;
}

/** A sidebar navigation row: icon + label, with an active (purple) state. */
export function SidebarNavItem({
  label,
  icon,
  href,
  active = false,
  badge,
  as = "a",
  onClick,
}: SidebarNavItemProps) {
  const className = cn(
    "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition",
    active ? "bg-brand-50 text-brand-800" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
  );
  const inner = (
    <>
      <span className={active ? "text-brand-600" : "text-slate-400"}>{icon}</span>
      <span className="flex-1">{label}</span>
      {badge != null ? (
        <span className="rounded-pill bg-brand-600 px-1.5 text-xs font-semibold text-white">{badge}</span>
      ) : null}
    </>
  );

  if (as === "button") {
    return (
      <button type="button" onClick={onClick} aria-current={active ? "page" : undefined} className={cn(className, "w-full text-left")}>
        {inner}
      </button>
    );
  }
  return (
    <a href={href} aria-current={active ? "page" : undefined} className={className}>
      {inner}
    </a>
  );
}
