"use client";
import { createContext, useContext } from "react";
import type { CajaModuleContextValue } from "./types";

const CajaModuleContext = createContext<CajaModuleContextValue | null>(null);

export function CajaModuleProvider({
  value,
  children,
}: {
  value: CajaModuleContextValue;
  children: React.ReactNode;
}) {
  return <CajaModuleContext.Provider value={value}>{children}</CajaModuleContext.Provider>;
}

export function useCajaModule(): CajaModuleContextValue {
  const ctx = useContext(CajaModuleContext);
  if (!ctx) throw new Error("useCajaModule must be used within CajaModuleProvider");
  return ctx;
}
