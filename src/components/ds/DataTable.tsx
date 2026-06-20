"use client";

import { useMemo, useState, type ReactNode } from "react";
import { cn } from "./util";
import { SearchInput } from "./SearchInput";

export interface Column<T> {
  key: string;
  header: ReactNode;
  render?: (row: T) => ReactNode;
  align?: "left" | "right" | "center";
  className?: string;
}

export interface DataTableProps<T> {
  columns: Column<T>[];
  rows: T[];
  getRowKey: (row: T, index: number) => string;
  /** Enable the built-in search box (uses `searchAccessor`). */
  searchable?: boolean;
  searchAccessor?: (row: T) => string;
  searchPlaceholder?: string;
  /** Extra filter controls rendered in the toolbar (e.g. a Select). */
  filters?: ReactNode;
  empty?: ReactNode;
}

const alignClass = { left: "text-left", right: "text-right", center: "text-center" } as const;

/** Table with a search/filter toolbar. */
export function DataTable<T>({
  columns,
  rows,
  getRowKey,
  searchable = true,
  searchAccessor,
  searchPlaceholder = "Search…",
  filters,
  empty = "No results.",
}: DataTableProps<T>) {
  const [query, setQuery] = useState("");

  const visible = useMemo(() => {
    if (!searchable || !searchAccessor || !query.trim()) return rows;
    const q = query.trim().toLowerCase();
    return rows.filter((r) => searchAccessor(r).toLowerCase().includes(q));
  }, [rows, query, searchable, searchAccessor]);

  return (
    <div className="overflow-hidden rounded-card border border-slate-200 bg-white shadow-card">
      {(searchable || filters) && (
        <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 p-3">
          {searchable ? (
            <SearchInput
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={searchPlaceholder}
              containerClassName="w-full sm:max-w-xs"
            />
          ) : null}
          {filters ? <div className="flex items-center gap-2">{filters}</div> : null}
          <span className="ml-auto text-sm text-slate-400">{visible.length} of {rows.length}</span>
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-400">
              {columns.map((c) => (
                <th key={c.key} className={cn("px-5 py-3 font-medium", c.align && alignClass[c.align])}>
                  {c.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {visible.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-5 py-8 text-center text-slate-500">
                  {empty}
                </td>
              </tr>
            ) : (
              visible.map((row, i) => (
                <tr key={getRowKey(row, i)} className="hover:bg-slate-50">
                  {columns.map((c) => (
                    <td key={c.key} className={cn("px-5 py-3 text-slate-700", c.align && alignClass[c.align], c.className)}>
                      {c.render ? c.render(row) : (row as Record<string, ReactNode>)[c.key]}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
