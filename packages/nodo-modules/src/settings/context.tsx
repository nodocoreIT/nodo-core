"use client";
import { createContext, useContext } from "react";
import type { SettingsModuleContextValue } from "./types";

const SettingsModuleContext = createContext<SettingsModuleContextValue | null>(null);

export function SettingsModuleProvider({
  value,
  children,
}: {
  value: SettingsModuleContextValue;
  children: React.ReactNode;
}) {
  return (
    <SettingsModuleContext.Provider value={value}>{children}</SettingsModuleContext.Provider>
  );
}

export function useSettingsModule(): SettingsModuleContextValue {
  const ctx = useContext(SettingsModuleContext);
  if (!ctx) {
    throw new Error("useSettingsModule must be used within SettingsModuleProvider");
  }
  return ctx;
}
