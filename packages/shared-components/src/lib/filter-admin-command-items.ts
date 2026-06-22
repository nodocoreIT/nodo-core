import { foldForSearch } from "./utils";
import type { AdminCommandPaletteItem } from "../components/admin-command-palette";

export function filterAdminCommandItems(
  items: AdminCommandPaletteItem[],
  query: string,
): AdminCommandPaletteItem[] {
  const q = foldForSearch(query.trim());
  if (!q) return items;

  return items.filter((item) => {
    const haystack = foldForSearch(
      [item.label, item.group, ...(item.keywords ?? [])].filter(Boolean).join(" "),
    );
    return haystack.includes(q);
  });
}
