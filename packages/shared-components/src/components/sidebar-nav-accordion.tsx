"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

/** Collapsible sidebar sections only when the nav has more than this many items. */
export const SIDEBAR_COLLAPSE_THRESHOLD = 8;

type SidebarNavAccordionContextValue = {
  collapsible: boolean;
  openGroupId: string | null;
  toggleGroup: (groupId: string) => void;
  /** Auto-expand when entering a section (respects manual collapse until route leaves). */
  revealGroup: (groupId: string) => void;
  /** Clear manual collapse when the active route leaves this section. */
  clearManualCollapse: (groupId: string) => void;
};

const SidebarNavAccordionContext =
  createContext<SidebarNavAccordionContextValue | null>(null);

export function useSidebarNavAccordion() {
  return useContext(SidebarNavAccordionContext);
}

export interface SidebarNavAccordionProviderProps {
  /** Total visible nav items in the sidebar (links). */
  itemCount: number;
  children: ReactNode;
}

export function SidebarNavAccordionProvider({
  itemCount,
  children,
}: SidebarNavAccordionProviderProps) {
  const collapsible = itemCount > SIDEBAR_COLLAPSE_THRESHOLD;
  const [openGroupId, setOpenGroupId] = useState<string | null>(null);
  const manuallyCollapsedRef = useRef<Set<string>>(new Set());

  const toggleGroup = useCallback(
    (groupId: string) => {
      if (!collapsible) return;
      setOpenGroupId((current) => {
        if (current === groupId) {
          manuallyCollapsedRef.current.add(groupId);
          return null;
        }
        manuallyCollapsedRef.current.delete(groupId);
        return groupId;
      });
    },
    [collapsible],
  );

  const revealGroup = useCallback(
    (groupId: string) => {
      if (!collapsible) return;
      if (manuallyCollapsedRef.current.has(groupId)) return;
      setOpenGroupId(groupId);
    },
    [collapsible],
  );

  const clearManualCollapse = useCallback((groupId: string) => {
    manuallyCollapsedRef.current.delete(groupId);
  }, []);

  const value = useMemo(
    () => ({
      collapsible,
      openGroupId,
      toggleGroup,
      revealGroup,
      clearManualCollapse,
    }),
    [collapsible, openGroupId, toggleGroup, revealGroup, clearManualCollapse],
  );

  return (
    <SidebarNavAccordionContext.Provider value={value}>
      {children}
    </SidebarNavAccordionContext.Provider>
  );
}
