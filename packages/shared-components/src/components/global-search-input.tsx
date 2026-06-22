import { SearchInput, type SearchInputProps } from "./search-input";
import { useSearchStore } from "../hooks/use-search-store";
import { useGlobalSearchHotkey } from "../hooks/use-global-search-hotkey";

export interface GlobalSearchInputProps
  extends Omit<SearchInputProps, "value" | "onChange"> {}

/**
 * SearchInput wired to the shared useSearchStore — for admin top bars.
 * Ctrl/Cmd + K focuses the field when visible on the page.
 */
export function GlobalSearchInput({
  placeholder = "Buscar…",
  className,
}: GlobalSearchInputProps) {
  const query = useSearchStore((s) => s.query);
  const setQuery = useSearchStore((s) => s.setQuery);

  useGlobalSearchHotkey(true);

  return (
    <SearchInput
      value={query}
      onChange={setQuery}
      placeholder={placeholder}
      className={className}
    />
  );
}
