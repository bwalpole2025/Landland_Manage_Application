"use client";

import { useState, type ReactNode } from "react";
import { cn } from "./util";

export interface TabItem {
  id: string;
  label: ReactNode;
  badge?: ReactNode;
}

export interface TabsProps {
  items: TabItem[];
  /** Controlled active id (omit for uncontrolled). */
  value?: string;
  defaultValue?: string;
  onChange?: (id: string) => void;
}

export function Tabs({ items, value, defaultValue, onChange }: TabsProps) {
  const [internal, setInternal] = useState(defaultValue ?? items[0]?.id);
  const active = value ?? internal;

  function select(id: string) {
    if (value === undefined) setInternal(id);
    onChange?.(id);
  }

  return (
    <div className="flex gap-1 border-b border-slate-200" role="tablist">
      {items.map((item) => {
        const isActive = item.id === active;
        return (
          <button
            key={item.id}
            role="tab"
            aria-selected={isActive}
            onClick={() => select(item.id)}
            className={cn(
              "relative -mb-px flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition",
              isActive
                ? "border-b-2 border-brand-600 text-brand-700"
                : "border-b-2 border-transparent text-slate-500 hover:text-slate-800",
            )}
          >
            {item.label}
            {item.badge != null ? (
              <span className="rounded-pill bg-slate-100 px-1.5 text-xs text-slate-600">{item.badge}</span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
