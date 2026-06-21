"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/components/ds/util";
import { ChevronDownIcon, ChevronRightIcon, CollapseIcon } from "@/components/icons";
import { AccountDropdown } from "./AccountDropdown";
import { Logo } from "@/components/brand/Logo";
import { NAV, matchNav, type NavEntry } from "./nav";
import type { AppSession } from "@/server/auth/session";

export interface SidebarProps {
  session: AppSession;
  collapsed: boolean;
  mobileOpen: boolean;
  onToggleCollapse: () => void;
  onNavigate: () => void;
}

export function Sidebar({ session, collapsed, mobileOpen, onToggleCollapse, onNavigate }: SidebarProps) {
  const pathname = usePathname();
  const match = matchNav(pathname);
  const activeGroup = match?.entry.children ? match.entry.label : null;

  const [openGroups, setOpenGroups] = useState<Set<string>>(
    () => new Set(activeGroup ? [activeGroup] : []),
  );

  // Keep the active group expanded as the user navigates.
  useEffect(() => {
    if (activeGroup) setOpenGroups((prev) => (prev.has(activeGroup) ? prev : new Set(prev).add(activeGroup)));
  }, [activeGroup]);

  function toggleGroup(label: string) {
    setOpenGroups((prev) => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });
  }

  return (
    <aside
      className={cn(
        "fixed inset-y-0 left-0 z-40 flex flex-col border-r border-slate-200 bg-white transition-[width,transform] duration-200 lg:static lg:translate-x-0",
        collapsed ? "w-16" : "w-64",
        mobileOpen ? "translate-x-0" : "-translate-x-full",
      )}
    >
      {/* Logo → Overview */}
      <div className={cn("flex h-16 shrink-0 items-center border-b border-slate-100", collapsed ? "justify-center px-2" : "px-5")}>
        <Link href="/dashboard" onClick={onNavigate} className="flex items-center gap-2" aria-label="PropManage — Overview">
          <Logo className="h-8 w-8 shrink-0" />
          {!collapsed ? <span className="text-lg font-semibold tracking-tight text-slate-900">PropManage</span> : null}
        </Link>
      </div>

      {/* Account / profile dropdown (shows the user's email) */}
      <div className={cn("border-b border-slate-100", collapsed ? "p-2" : "p-3")}>
        <AccountDropdown session={session} collapsed={collapsed} />
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-0.5 overflow-y-auto p-2">
        {NAV.map((entry) =>
          entry.children ? (
            <GroupItem
              key={entry.label}
              entry={entry}
              collapsed={collapsed}
              open={openGroups.has(entry.label)}
              activeChildHref={match?.child?.href}
              isActiveGroup={match?.entry.label === entry.label}
              onToggle={() => toggleGroup(entry.label)}
              onNavigate={onNavigate}
            />
          ) : (
            <LeafLink
              key={entry.label}
              href={entry.href!}
              icon={<entry.icon />}
              label={entry.label}
              active={match?.entry.label === entry.label && !match.child}
              collapsed={collapsed}
              onNavigate={onNavigate}
            />
          ),
        )}
      </nav>

      {/* Collapse toggle */}
      <div className="border-t border-slate-100 p-2">
        <button
          onClick={onToggleCollapse}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className={cn(
            "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-slate-500 transition hover:bg-slate-100 hover:text-slate-700",
            collapsed && "justify-center px-0",
          )}
        >
          <CollapseIcon className={cn("shrink-0 transition-transform", collapsed && "rotate-180")} />
          {!collapsed ? <span>Collapse</span> : null}
        </button>
      </div>
    </aside>
  );
}

/** A row that links to a route, with an active highlight + left accent bar. */
function LeafLink({
  href,
  icon,
  label,
  active,
  collapsed,
  indented,
  onNavigate,
}: {
  href: string;
  icon?: React.ReactNode;
  label: string;
  active: boolean;
  collapsed: boolean;
  indented?: boolean;
  onNavigate: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onNavigate}
      title={collapsed ? label : undefined}
      aria-current={active ? "page" : undefined}
      className={cn(
        "relative flex items-center gap-3 rounded-lg py-2 text-sm font-medium transition",
        collapsed ? "justify-center px-0" : indented ? "pl-11 pr-3" : "px-3",
        active ? "bg-brand-50 text-brand-800" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
      )}
    >
      {/* Left accent bar */}
      {active ? <span className="absolute inset-y-1 left-0 w-1 rounded-r bg-brand-600" /> : null}
      {icon ? <span className={cn("shrink-0", active ? "text-brand-600" : "text-slate-400")}>{icon}</span> : null}
      {!collapsed ? <span className="truncate">{label}</span> : null}
    </Link>
  );
}

/** An expandable group: toggles a chevron and reveals indented children. */
function GroupItem({
  entry,
  collapsed,
  open,
  activeChildHref,
  isActiveGroup,
  onToggle,
  onNavigate,
}: {
  entry: NavEntry;
  collapsed: boolean;
  open: boolean;
  activeChildHref?: string;
  isActiveGroup: boolean;
  onToggle: () => void;
  onNavigate: () => void;
}) {
  const Icon = entry.icon;

  // Collapsed: the group icon links straight to its first child.
  if (collapsed) {
    return (
      <LeafLink
        href={entry.children![0].href}
        icon={<Icon />}
        label={entry.label}
        active={isActiveGroup}
        collapsed
        onNavigate={onNavigate}
      />
    );
  }

  return (
    <div>
      <button
        onClick={onToggle}
        aria-expanded={open}
        className={cn(
          "relative flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition",
          isActiveGroup ? "text-brand-800" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
        )}
      >
        <span className={cn("shrink-0", isActiveGroup ? "text-brand-600" : "text-slate-400")}>
          <Icon />
        </span>
        <span className="flex-1 truncate text-left">{entry.label}</span>
        {open ? <ChevronDownIcon width={16} height={16} className="text-slate-400" /> : <ChevronRightIcon width={16} height={16} className="text-slate-400" />}
      </button>
      {open ? (
        <div className="mt-0.5 space-y-0.5">
          {entry.children!.map((child) => (
            <LeafLink
              key={child.href}
              href={child.href}
              label={child.label}
              active={activeChildHref === child.href}
              collapsed={false}
              indented
              onNavigate={onNavigate}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}
