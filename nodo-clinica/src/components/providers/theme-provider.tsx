"use client";

import { usePatientTheme } from "@/hooks/use-theme-settings";

/** Tema público/paciente por defecto — no lee colores del médico. */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  usePatientTheme();
  return <>{children}</>;
}
