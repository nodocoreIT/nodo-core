"use client";

/**
 * ThemeInitializer for the medico portal.
 * Follows the nodo-scaffold pattern:
 *   1. useClinicaThemeSync() — loads theme_settings from Supabase → Zustand store
 *   2. useThemeSettings() — applies Zustand store → CSS custom properties on :root
 *
 * Must be rendered inside an authenticated context (doctor session already
 * verified by MedicoAdminLayout before this component renders).
 */
import type { ReactNode } from "react";
import { useClinicaThemeSync } from "@/shared/hooks/use-clinica-theme-sync";
import { useThemeSettings } from "@/shared/hooks/use-theme-settings";

function ThemeInitializer({ children }: { children: ReactNode }) {
  // 1. Load from Supabase → merge into Zustand store
  useClinicaThemeSync();

  // 2. Apply Zustand store → CSS custom properties on :root
  useThemeSettings();

  return <>{children}</>;
}

export function MedicoThemeProvider({ children }: { children: ReactNode }) {
  return <ThemeInitializer>{children}</ThemeInitializer>;
}
