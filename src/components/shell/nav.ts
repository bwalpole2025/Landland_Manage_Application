import type { ComponentType, SVGProps } from "react";
import {
  HomeIcon,
  TransactionsIcon,
  PropertyIcon,
  TaxIcon,
  MtdIcon,
  FilesIcon,
  ReportsIcon,
  HelpIcon,
} from "@/components/icons";

type IconType = ComponentType<SVGProps<SVGSVGElement>>;

export interface NavLeaf {
  label: string;
  href: string;
}

export interface NavEntry {
  label: string;
  icon: IconType;
  /** Present on simple links; absent on expandable groups. */
  href?: string;
  /** Present on expandable groups. */
  children?: NavLeaf[];
  /** External link (opens in a new tab). */
  external?: boolean;
}

// Sidebar order, per the spec.
export const NAV: NavEntry[] = [
  { label: "Overview", href: "/dashboard", icon: HomeIcon },
  { label: "Transactions", href: "/transactions", icon: TransactionsIcon },
  {
    label: "My properties",
    icon: PropertyIcon,
    children: [
      { label: "Properties", href: "/properties" },
      { label: "Ownership", href: "/properties/ownership" },
      { label: "Tenancies", href: "/properties/tenancies" },
    ],
  },
  { label: "Tax", href: "/tax", icon: TaxIcon },
  { label: "MTD", href: "/mtd", icon: MtdIcon },
  {
    label: "Files & Dates",
    icon: FilesIcon,
    children: [
      { label: "Documents", href: "/files" },
      { label: "Notes", href: "/files/notes" },
      { label: "Reminders", href: "/files/reminders" },
      { label: "Calendar", href: "/files/calendar" },
    ],
  },
  { label: "Reports", href: "/reports", icon: ReportsIcon },
  { label: "Help", href: "/help", icon: HelpIcon },
];

export interface NavMatch {
  entry: NavEntry;
  child?: NavLeaf;
}

/** Collect every (entry, leaf) pair with a concrete href. */
function leaves(): { href: string; entry: NavEntry; child?: NavLeaf }[] {
  const out: { href: string; entry: NavEntry; child?: NavLeaf }[] = [];
  for (const entry of NAV) {
    if (entry.href) out.push({ href: entry.href, entry });
    for (const child of entry.children ?? []) out.push({ href: child.href, entry, child });
  }
  return out;
}

/** Resolve the active nav entry/child by longest matching href prefix. */
export function matchNav(pathname: string): NavMatch | null {
  let best: { href: string; entry: NavEntry; child?: NavLeaf } | null = null;
  for (const l of leaves()) {
    const isMatch = pathname === l.href || pathname.startsWith(l.href + "/");
    if (!isMatch) continue;
    if (!best || l.href.length > best.href.length) best = l;
  }
  return best ? { entry: best.entry, child: best.child } : null;
}

export interface Crumb {
  label: string;
  href?: string;
}

/** Breadcrumb trail for the current path, derived from the nav structure. */
export function breadcrumbsFor(pathname: string): Crumb[] {
  const match = matchNav(pathname);
  if (!match) return [{ label: "Overview", href: "/dashboard" }];

  const crumbs: Crumb[] = [];
  if (match.child) {
    // Group → child. Group crumb links to the group's first child.
    crumbs.push({ label: match.entry.label, href: match.entry.children?.[0]?.href });
    crumbs.push({ label: match.child.label, href: match.child.href });
  } else {
    crumbs.push({ label: match.entry.label, href: match.entry.href });
  }
  // Property detail (/properties/<id>): append a trailing crumb.
  if (match.child?.href === "/properties" && /^\/properties\/[^/]+$/.test(pathname)) {
    crumbs.push({ label: "Property" });
  }
  return crumbs;
}
