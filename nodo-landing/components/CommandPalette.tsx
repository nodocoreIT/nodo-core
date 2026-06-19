"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Command, Search } from "lucide-react";
import {
  buildCommandPaletteItems,
  COMMAND_PALETTE_GROUP_LABELS,
  filterCommandPaletteItems,
  type CommandPaletteGroup,
  type CommandPaletteItem,
} from "@/lib/command-palette-items";

const GROUP_ORDER: CommandPaletteGroup[] = [
  "navegacion",
  "unidades",
  "acceso",
  "acciones",
];

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function CommandPalette({ open, onClose }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);

  const allItems = useMemo(() => buildCommandPaletteItems(), []);
  const filteredItems = useMemo(
    () => filterCommandPaletteItems(allItems, query),
    [allItems, query],
  );

  const groupedItems = useMemo(() => {
    const groups = new Map<CommandPaletteGroup, CommandPaletteItem[]>();
    for (const group of GROUP_ORDER) {
      groups.set(group, []);
    }
    for (const item of filteredItems) {
      groups.get(item.group)?.push(item);
    }
    return GROUP_ORDER.flatMap((group) => {
      const items = groups.get(group) ?? [];
      if (items.length === 0) return [];
      return [{ group, items }];
    });
  }, [filteredItems]);

  const flatItems = useMemo(
    () => groupedItems.flatMap(({ items }) => items),
    [groupedItems],
  );

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

  const navigateTo = useCallback(
    (item: CommandPaletteItem) => {
      onClose();

      if (item.href.startsWith("/#")) {
        const sectionId = item.href.slice(2);
        if (pathname === "/") {
          document
            .getElementById(sectionId)
            ?.scrollIntoView({ behavior: "smooth" });
          window.history.replaceState(null, "", item.href);
          return;
        }
      }

      router.push(item.href);
    },
    [onClose, pathname, router],
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
        const item = flatItems[activeIndex];
        if (item) navigateTo(item);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, flatItems, activeIndex, onClose, navigateTo]);

  if (!open) return null;

  let runningIndex = -1;

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
        aria-label="Buscador del sitio"
        className="w-full max-w-[680px] overflow-hidden rounded-2xl shadow-2xl"
        style={{
          background: "var(--color-navy-900)",
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
            className="shrink-0"
            style={{ width: 18, height: 18, color: "var(--color-brand)" }}
          />
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Escribí un comando o buscá..."
            className="min-w-0 flex-1 bg-transparent text-[15px] text-white outline-none placeholder:text-white/35"
            aria-label="Buscar en el sitio"
          />
          <kbd
            className="hidden rounded-md px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-white/45 sm:inline-block"
            style={{ border: "1px solid rgba(255,255,255,.12)" }}
          >
            Esc
          </kbd>
        </div>

        <div className="max-h-[min(52vh,420px)] overflow-y-auto px-2 py-2">
          {flatItems.length === 0 ? (
            <p className="px-3 py-8 text-center text-[14px] text-white/45">
              No encontramos resultados para &ldquo;{query}&rdquo;.
            </p>
          ) : (
            groupedItems.map(({ group, items }) => (
              <div key={group} className="mb-2 last:mb-0">
                <p className="px-3 py-2 text-[11px] font-bold uppercase tracking-[.16em] text-white/35">
                  {COMMAND_PALETTE_GROUP_LABELS[group]}
                </p>
                <ul className="list-none p-0 m-0">
                  {items.map((item) => {
                    runningIndex += 1;
                    const itemIndex = runningIndex;
                    const isActive = itemIndex === activeIndex;

                    return (
                      <li key={item.id}>
                        <button
                          type="button"
                          onMouseEnter={() => setActiveIndex(itemIndex)}
                          onClick={() => navigateTo(item)}
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
                          {item.badge ? (
                            <span className="shrink-0 text-[11px] font-semibold uppercase tracking-wide text-white/35">
                              {item.badge}
                            </span>
                          ) : null}
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
