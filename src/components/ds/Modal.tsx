"use client";

import { useEffect, type ReactNode } from "react";
import { cn } from "./util";

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  size?: "sm" | "md" | "lg";
}

const sizes = { sm: "max-w-sm", md: "max-w-lg", lg: "max-w-2xl" };

/** Accessible modal/dialog with an overlay. Closes on Escape or overlay click. */
export function Modal({ open, onClose, title, description, children, footer, size = "md" }: ModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onClose} />
      <div className={cn("relative w-full rounded-card bg-white shadow-xl", sizes[size])}>
        {title || description ? (
          <div className="border-b border-slate-100 px-6 py-4">
            {title ? <h2 className="text-lg font-semibold text-slate-900">{title}</h2> : null}
            {description ? <p className="mt-1 text-sm text-slate-500">{description}</p> : null}
          </div>
        ) : null}
        {children ? <div className="px-6 py-5">{children}</div> : null}
        {footer ? (
          <div className="flex items-center justify-end gap-2 border-t border-slate-100 px-6 py-4">{footer}</div>
        ) : null}
      </div>
    </div>
  );
}
