import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { cn } from "./util";

export type ButtonVariant = "primary" | "secondary" | "outline" | "ghost";
export type ButtonSize = "sm" | "md" | "lg";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Render as a full-width block. */
  block?: boolean;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
}

const base =
  "inline-flex items-center justify-center gap-2 rounded-pill font-medium transition " +
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 " +
  "disabled:opacity-50 disabled:pointer-events-none select-none";

const variants: Record<ButtonVariant, string> = {
  // Primary: vivid purple/indigo.
  primary: "bg-brand-600 text-white hover:bg-brand-700 shadow-sm focus-visible:outline-brand-600",
  // Secondary: teal/cyan accent.
  secondary: "bg-accent-600 text-white hover:bg-accent-700 shadow-sm focus-visible:outline-accent-600",
  // Outline: bordered, neutral.
  outline:
    "bg-white text-slate-700 ring-1 ring-inset ring-slate-300 hover:bg-slate-50 focus-visible:outline-slate-400",
  ghost: "text-slate-600 hover:bg-slate-100 focus-visible:outline-slate-400",
};

const sizes: Record<ButtonSize, string> = {
  sm: "h-8 px-3.5 text-sm",
  md: "h-10 px-5 text-sm",
  lg: "h-12 px-6 text-base",
};

/** Pill-shaped button. Primary = purple, secondary = teal, plus outline/ghost. */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", size = "md", block, leftIcon, rightIcon, className, children, type = "button", ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={cn(base, variants[variant], sizes[size], block && "w-full", className)}
      {...rest}
    >
      {leftIcon ? <span className="-ml-0.5 shrink-0">{leftIcon}</span> : null}
      {children}
      {rightIcon ? <span className="-mr-0.5 shrink-0">{rightIcon}</span> : null}
    </button>
  );
});
