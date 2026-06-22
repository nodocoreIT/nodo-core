"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Command, Search } from "lucide-react";
import { filterAdminCommandItems } from "../lib/filter-admin-command-items";

export interface AdminCommandPaletteItem {
  id: string;
  label: string;
  href: string;
  group?: string;
  keywords?: string[];
}

export interface AdminCommandPaletteListSearch {
  label: string;
}

export interface AdminCommandPaletteProps {
  open: boolean;
  onClose: () => void;
  items: AdminCommandPaletteItem[];
  listSearch?: AdminCommandPaletteListSearch;
  onSelectItem: (item: AdminCommandPaletteItem, query: string) => void;
  onFilterCurrentList?: (query: string) => void;
}

const FILTER_CURRENT_ID = "__filter_current_list__";

export function AdminCommandPalette({
  open,
  onClose,
  items,
  listSearch,
  onSelectItem,
  onFilterCurrentList,
}: AdminCommandPaletteProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);

  const filteredItems = useMemo(
    () => filterAdminCommandItems(items, query),
    [items, query],
  );

  const groupedItems = useMemo(() => {
    const groups = new Map<string, AdminCommandPaletteItem[]>();
    for (const item of filteredItems) {
      const group = item.group ?? "Secciones";
      const bucket = groups.get(group) ?? [];
      bucket.push(item);
      groups.set(group, bucket);
    }
    return [...groups.entries()].map(([group, groupItems]) => ({
      group,
      items: groupItems,
    }));
  }, [filteredItems]);

  const showFilterCurrent =
    Boolean(listSearch && onFilterCurrentList && query.trim());

  const flatItems = useMemo(() => {
    const navItems = groupedItems.flatMap(({ items: groupItems }) => groupItems);
    if (!showFilterCurrent || !listSearch) return navItems;
    return [
      {
        id: FILTER_CURRENT_ID,
        label: `Filtrar en ${listSearch.label}`,
        href: "",
        group: "Acción rápida",
      } satisfies AdminCommandPaletteItem,
      ...navItems,
    ];
  }, [groupedItems, listSearch, showFilterCurrent]);

  const renderGroups = useMemo(() => {
    const groups = new Map<string, AdminCommandPaletteItem[]>();
    for (const item of flatItems) {
      const group = item.group ?? "Secciones";
      const bucket = groups.get(group) ?? [];
      bucket.push(item);
      groups.set(group, bucket);
    }
    return [...groups.entries()];
  }, [flatItems]);

  useEffect(() => {
    if (!open) return;
    setQuery("");
    setActiveIndex(0);
    document.body.style.overflow = "hidden";
    const timer = window.setTimeout(() => inputRef.current?.focus(), 0);
    return () => {
      window.clearTimeout(timer);
      document.body.style.overflow = "";
    };
  }, [open]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  const activate = useCallback(
    (index: number) => {
      const item = flatItems[index];
      if (!item) return;

      if (item.id === FILTER_CURRENT_ID) {
        onFilterCurrentList?.(query.trim());
        onClose();
        return;
      }

      onSelectItem(item, query);
      onClose();
    },
    [flatItems, onClose, onFilterCurrentList, onSelectItem, query],
  );

  useEffect(() => {
    if (!open) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }

      if (flatItems.length === 0) return;

      if (event.key === "ArrowDown") {
        event.preventDefault();
        setActiveIndex((current) => (current + 1) % flatItems.length);
      }

      if (event.key === "ArrowUp") {
        event.preventDefault();
        setActiveIndex(
          (current) => (current - 1 + flatItems.length) % flatItems.length,
        );
      }

      if (event.key === "Enter") {
        event.preventDefault();
        activate(activeIndex);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, flatItems, activeIndex, onClose, activate]);

  if (!open) return null;

  const itemIndexById = new Map(flatItems.map((item, index) => [item.id, index]));

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center px-4 pt-[min(18vh,140px)]"
      style={{
        backdropFilter: "blur(10px)",
        WebkitBackdropFilter: "blur(10px)",
        backgroundColor: "rgba(5,14,28,0.72)",
      }}
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Buscar en el panel"
        className="w-full max-w-[680px] overflow-hidden rounded-2xl shadow-2xl"
        style={{
          background: "var(--color-navy-900, #0a1628)",
          border: "1px solid rgba(255,255,255,.12)",
          boxShadow: "0 24px 80px rgba(0,0,0,.45)",
        }}
        onClick={(event) => event.stopPropagation()}
      >
        <div
          className="flex items-center gap-3 px-4 py-3.5"
          style={{ borderBottom: "1px solid rgba(255,255,255,.08)" }}
        >
          <Search
            aria-hidden
            className="shrink-0 text-brand"
            style={{ width: 18, height: 18 }}
          />
          <input
            ref={inputRef}
            data-global-search-input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar secciones o escribí para filtrar…"
            className="min-w-0 flex-1 bg-transparent text-[15px] text-white outline-none placeholder:text-white/35"
            aria-label="Buscar en el panel"
          />
          <kbd className="hidden rounded-md border border-white/12 px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-white/45 sm:inline-block">
            Esc
          </kbd>
        </div>

        <div className="max-h-[min(52vh,420px)] overflow-y-auto px-2 py-2">
          {flatItems.length === 0 ? (
            <p className="px-3 py-8 text-center text-[14px] text-white/45">
              No encontramos resultados para &ldquo;{query}&rdquo;.
            </p>
          ) : (
            renderGroups.map(([group, groupItems]) => (
              <div key={group} className="mb-2 last:mb-0">
                <p className="px-3 py-2 text-[11px] font-bold uppercase tracking-[.16em] text-white/35">
                  {group}
                </p>
                <ul className="m-0 list-none p-0">
                  {groupItems.map((item) => {
                    const itemIndex = itemIndexById.get(item.id) ?? 0;
                    const isActive = itemIndex === activeIndex;

                    return (
                      <li key={item.id}>
                        <button
                          type="button"
                          onMouseEnter={() => setActiveIndex(itemIndex)}
                          onClick={() => activate(itemIndex)}
                          className="flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-left transition-colors"
                          style={{
                            backgroundColor: isActive
                              ? "rgba(218,90,14,.16)"
                              : "transparent",
                            color: isActive ? "#fff" : "rgba(234,240,247,.82)",
                          }}
                        >
                          <span className="text-[14px] font-medium">
                            {item.label}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))
          )}
        </div>

        <div
          className="flex items-center justify-between gap-3 px-4 py-2.5 text-[11px] text-white/35"
          style={{ borderTop: "1px solid rgba(255,255,255,.08)" }}
        >
          <span className="inline-flex items-center gap-1.5">
            <Command aria-hidden style={{ width: 12, height: 12 }} />
            Navegá con ↑ ↓ · Enter para ir
          </span>
          <span className="hidden sm:inline">Ctrl + K para abrir</span>
        </div>
      </div>
    </div>
  );
}
