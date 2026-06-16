"use client";

import { useEffect } from "react";
import {
  configureThemeDefaults,
  useThemeSettings,
} from "@/hooks/use-theme-settings";

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  useThemeSettings();

  useEffect(() => {
    configureThemeDefaults({ brandText: "nodo salud" });
  }, []);

  return <>{children}</>;
}
