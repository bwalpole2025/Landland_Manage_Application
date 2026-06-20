import { forwardRef, type InputHTMLAttributes } from "react";
import { cn } from "./util";

function SearchGlyph() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </svg>
  );
}

export interface SearchInputProps extends InputHTMLAttributes<HTMLInputElement> {
  containerClassName?: string;
}

export const SearchInput = forwardRef<HTMLInputElement, SearchInputProps>(function SearchInput(
  { className, containerClassName, placeholder = "Search…", ...rest },
  ref,
) {
  return (
    <div className={cn("relative", containerClassName)}>
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
        <SearchGlyph />
      </span>
      <input
        ref={ref}
        type="search"
        placeholder={placeholder}
        className={cn(
          "h-10 w-full rounded-pill border border-slate-300 bg-white pl-9 pr-4 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-100",
          className,
        )}
        {...rest}
      />
    </div>
  );
});
