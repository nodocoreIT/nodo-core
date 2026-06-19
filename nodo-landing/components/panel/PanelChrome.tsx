"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import Sidebar, { type SidebarProps } from "./Sidebar";
import { PanelDocumentTitle } from "./PanelDocumentTitle";

type PanelShellContextValue = {
  openMobileMenu: () => void;
};

const PanelShellContext = createContext<PanelShellContextValue | null>(null);

export function usePanelShell() {
  return useContext(PanelShellContext);
}

export type PanelChromeSidebarProps = Omit<
  SidebarProps,
  "mobileOpen" | "onMobileClose"
>;

export function PanelChrome({
  sidebarProps,
  children,
}: {
  sidebarProps: PanelChromeSidebarProps;
  children: ReactNode;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <PanelShellContext.Provider
      value={{ openMobileMenu: () => setMobileOpen(true) }}
    >
      <div className="flex h-dvh overflow-hidden bg-paper">
        <PanelDocumentTitle />
        {mobileOpen && (
          <div
            className="fixed inset-0 z-40 bg-black/50 md:hidden"
            onClick={() => setMobileOpen(false)}
            aria-hidden
          />
        )}
        <Sidebar
          {...sidebarProps}
          mobileOpen={mobileOpen}
          onMobileClose={() => setMobileOpen(false)}
        />
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
          {children}
        </div>
      </div>
    </PanelShellContext.Provider>
  );
}
