"use client";

import { Fragment } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { breadcrumbsFor } from "./nav";

/** Breadcrumb trail that updates with the active route. */
export function Breadcrumbs() {
  const pathname = usePathname();
  const crumbs = breadcrumbsFor(pathname);

  return (
    <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-sm">
      {crumbs.map((crumb, i) => {
        const last = i === crumbs.length - 1;
        return (
          <Fragment key={i}>
            {crumb.href && !last ? (
              <Link href={crumb.href} className="text-slate-500 transition hover:text-slate-700">
                {crumb.label}
              </Link>
            ) : (
              <span className={last ? "font-medium text-slate-900" : "text-slate-500"} aria-current={last ? "page" : undefined}>
                {crumb.label}
              </span>
            )}
            {!last ? <span className="text-slate-300">/</span> : null}
          </Fragment>
        );
      })}
    </nav>
  );
}
