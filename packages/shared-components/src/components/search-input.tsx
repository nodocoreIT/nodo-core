import { Search } from "lucide-react";
import { cn } from "../lib/utils";

export interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

/**
 * Pure controlled search input.
 * The consumer owns the state — pass value + onChange from a store or local state.
 */
export function SearchInput({
  value,
  onChange,
  placeholder = "Buscar…",
  className,
}: SearchInputProps) {
  return (
    <div className={cn("relative w-72 max-w-full", className)}>
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate2" />
      <input
        type="search"
        role="searchbox"
        aria-label={placeholder}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-10 w-full rounded-pill border border-border bg-paper pl-9 pr-4 text-sm text-foreground placeholder:text-slate2 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
      />
    </div>
  );
}
