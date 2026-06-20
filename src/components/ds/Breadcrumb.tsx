import { Fragment, type ReactNode } from "react";

export interface Crumb {
  label: ReactNode;
  href?: string;
}

export function Breadcrumb({ items }: { items: Crumb[] }) {
  return (
    <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-sm text-slate-500">
      {items.map((item, i) => {
        const last = i === items.length - 1;
        return (
          <Fragment key={i}>
            {item.href && !last ? (
              <a href={item.href} className="transition hover:text-slate-700">
                {item.label}
              </a>
            ) : (
              <span className={last ? "font-medium text-slate-700" : undefined} aria-current={last ? "page" : undefined}>
                {item.label}
              </span>
            )}
            {!last ? <span className="text-slate-300">/</span> : null}
          </Fragment>
        );
      })}
    </nav>
  );
}
