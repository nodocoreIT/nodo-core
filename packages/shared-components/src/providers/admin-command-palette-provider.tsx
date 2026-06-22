"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  AdminCommandPalette,
  type AdminCommandPaletteItem,
  type AdminCommandPaletteListSearch,
} from "../components/admin-command-palette";

interface AdminCommandPaletteContextValue {
  open: () => void;
  close: () => void;
  toggle: () => void;
  isOpen: boolean;
}

const AdminCommandPaletteContext =
  createContext<AdminCommandPaletteContextValue | null>(null);

export function useAdminCommandPalette() {
  const context = useContext(AdminCommandPaletteContext);
  if (!context) {
    throw new Error(
      "useAdminCommandPalette must be used within AdminCommandPaletteProvider",
    );
  }
  return context;
}

export interface AdminCommandPaletteProviderProps {
  items: AdminCommandPaletteItem[];
  onSelectItem: (item: AdminCommandPaletteItem, query: string) => void;
  /** When set, offers "Filtrar en …" for the current searchable list. */
  listSearch?: AdminCommandPaletteListSearch;
  onFilterCurrentList?: (query: string) => void;
  children: ReactNode;
}

export function AdminCommandPaletteProvider({
  items,
  onSelectItem,
  listSearch,
  onFilterCurrentList,
  children,
}: AdminCommandPaletteProviderProps) {
  const [isOpen, setIsOpen] = useState(false);

  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);
  const toggle = useCallback(() => setIsOpen((current) => !current), []);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      const isModifier = event.metaKey || event.ctrlKey;
      if (!isModifier || event.key.toLowerCase() !== "k") return;

      event.preventDefault();
      toggle();
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [toggle]);

  const value = useMemo(
    () => ({ open, close, toggle, isOpen }),
    [open, close, toggle, isOpen],
  );

  return (
    <AdminCommandPaletteContext.Provider value={value}>
      {children}
      <AdminCommandPalette
        open={isOpen}
        onClose={close}
        items={items}
        listSearch={listSearch}
        onSelectItem={onSelectItem}
        onFilterCurrentList={onFilterCurrentList}
      />
    </AdminCommandPaletteContext.Provider>
  );
}
