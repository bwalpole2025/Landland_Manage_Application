import type { ReactNode } from "react";
import { Card } from "@/components/ui";
import { LockIcon } from "@/components/icons";

export interface LockedOverlayProps {
  /** "data" → UNLOCK YOUR DATA; "feature" → SUBSCRIBE TO UNLOCK. */
  variant?: "data" | "feature";
  message: string;
  /** Owners get a Subscribe CTA; others are told to ask the owner. */
  canManageBilling: boolean;
  /** Optional content rendered blurred behind the overlay. */
  children?: ReactNode;
}

/**
 * The premium gate. Shows a lock + headline + role-aware CTA. When `children`
 * are supplied they are rendered blurred and non-interactive behind the overlay
 * (the "peek" pattern); otherwise a plain locked panel is shown. Premium *data*
 * should not be passed as children — gate it server-side and show a plain panel.
 */
export function LockedOverlay({ variant = "data", message, canManageBilling, children }: LockedOverlayProps) {
  const headline = variant === "data" ? "Unlock your data" : "Subscribe to unlock";

  const overlay = (
    <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-100 text-brand-700">
        <LockIcon width={22} height={22} />
      </span>
      <p className="mt-3 text-sm font-bold uppercase tracking-wider text-brand-700">{headline}</p>
      <p className="mt-1 max-w-md text-sm text-slate-500">{message}</p>
      {canManageBilling ? (
        <a
          href="/settings#subscription"
          className="mt-4 inline-flex items-center rounded-pill bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
        >
          Subscribe — add a payment method
        </a>
      ) : (
        <p className="mt-4 text-xs text-slate-400">Ask the account owner to subscribe to unlock this.</p>
      )}
    </div>
  );

  if (!children) {
    return <Card>{overlay}</Card>;
  }

  return (
    <div className="relative">
      <div className="pointer-events-none select-none blur-[3px]" aria-hidden>
        {children}
      </div>
      <div className="absolute inset-0 flex items-center justify-center bg-white/40 backdrop-blur-[1px]">
        {overlay}
      </div>
    </div>
  );
}
