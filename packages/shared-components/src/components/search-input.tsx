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
    <div
      className={cn(
        "flex h-10 w-full max-w-full items-center gap-2.5 rounded-pill border border-border bg-paper px-3 sm:max-w-[14rem] md:max-w-[16rem]",
        "focus-within:border-brand focus-within:ring-2 focus-within:ring-brand/20",
        className,
      )}
    >
      <Search className="h-4 w-4 shrink-0 text-slate2" aria-hidden />
      <input
        type="search"
        role="searchbox"
        aria-label={placeholder}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="min-w-0 flex-1 border-0 bg-transparent py-0 text-sm text-foreground placeholder:text-slate2 focus:outline-none focus:ring-0"
      />
    </div>
  );
}
