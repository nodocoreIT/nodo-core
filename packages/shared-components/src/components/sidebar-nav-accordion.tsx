"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

/** Collapsible sidebar sections only when the nav has more than this many items. */
export const SIDEBAR_COLLAPSE_THRESHOLD = 8;

type SidebarNavAccordionContextValue = {
  collapsible: boolean;
  openGroupId: string | null;
  toggleGroup: (groupId: string) => void;
  openGroup: (groupId: string) => void;
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

  const toggleGroup = useCallback(
    (groupId: string) => {
      if (!collapsible) return;
      setOpenGroupId((current) => (current === groupId ? null : groupId));
    },
    [collapsible],
  );

  const openGroup = useCallback(
    (groupId: string) => {
      if (!collapsible) return;
      setOpenGroupId(groupId);
    },
    [collapsible],
  );

  const value = useMemo(
    () => ({ collapsible, openGroupId, toggleGroup, openGroup }),
    [collapsible, openGroupId, toggleGroup, openGroup],
  );

  return (
    <SidebarNavAccordionContext.Provider value={value}>
      {children}
    </SidebarNavAccordionContext.Provider>
  );
}
