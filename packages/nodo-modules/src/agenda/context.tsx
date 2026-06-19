import { createContext, useContext } from "react";
import type { AgendaModuleConfig, AgendaTasksHandlers } from "./types";

export interface AgendaModuleContextValue extends AgendaModuleConfig, AgendaTasksHandlers {}

const AgendaModuleContext = createContext<AgendaModuleContextValue | null>(null);

export function AgendaModuleProvider({
  value,
  children,
}: {
  value: AgendaModuleContextValue;
  children: React.ReactNode;
}) {
  return (
    <AgendaModuleContext.Provider value={value}>{children}</AgendaModuleContext.Provider>
  );
}

export function useAgendaModule(): AgendaModuleContextValue {
  const ctx = useContext(AgendaModuleContext);
  if (!ctx) {
    throw new Error("useAgendaModule must be used within AgendaModuleProvider");
  }
  return ctx;
}
