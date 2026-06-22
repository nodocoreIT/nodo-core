import { SearchInput, type SearchInputProps } from "./search-input";
import { useSearchStore } from "../hooks/use-search-store";

export interface GlobalSearchInputProps
  extends Omit<SearchInputProps, "value" | "onChange"> {}

/**
 * SearchInput wired to the shared useSearchStore — for admin top bars.
 * Use AdminCommandPaletteProvider for Ctrl/Cmd + K navigation and filtering.
 */
export function GlobalSearchInput({
  placeholder = "Buscar…",
  className,
}: GlobalSearchInputProps) {
  const query = useSearchStore((s) => s.query);
  const setQuery = useSearchStore((s) => s.setQuery);

  return (
    <SearchInput
      value={query}
      onChange={setQuery}
      placeholder={placeholder}
      className={className}
    />
  );
}
