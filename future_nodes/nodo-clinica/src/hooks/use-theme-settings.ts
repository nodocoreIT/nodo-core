"use client";

import { useEffect } from "react";
import { create } from "zustand";
import {
  DEFAULT_THEME_SETTINGS,
  mergeThemeSettings,
  type DoctorThemeSettings,
} from "@/lib/clinic/theme-settings";

export type ThemeSettings = DoctorThemeSettings;
export const DEFAULT_SETTINGS = DEFAULT_THEME_SETTINGS;

interface ThemeStore {
  settings: DoctorThemeSettings;
  hydrated: boolean;
  setSettings: (newSettings: Partial<DoctorThemeSettings>) => void;
  hydrateSettings: (settings: Partial<DoctorThemeSettings>) => void;
  resetSettings: () => void;
}

const persistLocal = (settings: DoctorThemeSettings) => {
  try {
    localStorage.setItem("nodo-theme-settings", JSON.stringify(settings));
  } catch {
    /* ignore */
  }
};

const getInitialSettings = (): DoctorThemeSettings => {
  if (typeof window === "undefined") return DEFAULT_THEME_SETTINGS;
  try {
    const stored = localStorage.getItem("nodo-theme-settings");
    if (stored) {
      return mergeThemeSettings(JSON.parse(stored));
    }
  } catch {
    /* ignore */
  }
  return DEFAULT_THEME_SETTINGS;
};

export const useThemeStore = create<ThemeStore>((set) => ({
  settings: DEFAULT_THEME_SETTINGS,
  hydrated: false,
  setSettings: (newSettings) =>
    set((state) => {
      const next = mergeThemeSettings({ ...state.settings, ...newSettings });
      persistLocal(next);
      return { settings: next, hydrated: true };
    }),
  hydrateSettings: (newSettings) =>
    set(() => {
      const next = mergeThemeSettings(newSettings);
      persistLocal(next);
      return { settings: next, hydrated: true };
    }),
  resetSettings: () => {
    try {
      localStorage.removeItem("nodo-theme-settings");
    } catch {
      /* ignore */
    }
    set({ settings: DEFAULT_THEME_SETTINGS, hydrated: true });
  },
}));

export function configureThemeDefaults(overrides: Partial<DoctorThemeSettings>): void {
  if (typeof window === "undefined") return;
  try {
    const stored = localStorage.getItem("nodo-theme-settings");
    if (!stored) {
      const merged = mergeThemeSettings(overrides);
      useThemeStore.setState({ settings: merged });
    }
  } catch {
    /* ignore */
  }
}

export function useThemeSettings() {
  const { settings, setSettings, hydrateSettings, resetSettings } = useThemeStore();

  useEffect(() => {
    useThemeStore.setState({ settings: getInitialSettings(), hydrated: true });
  }, []);

  useEffect(() => {
    const root = document.documentElement;

    root.style.setProperty("--color-brand", settings.primaryColor);
    root.style.setProperty("--color-brand-600", settings.primaryColor + "e0");
    root.style.setProperty("--color-brand-300", settings.primaryColor + "60");
    root.style.setProperty("--color-ring", settings.primaryColor);
    root.style.setProperty("--color-primary-foreground", settings.buttonFontColor);
    root.style.setProperty("--color-primary", settings.primaryColor);
    root.style.setProperty("--primary", settings.primaryColor);

    root.style.setProperty("--color-navy", "#121e2f");
    root.style.setProperty("--color-navy-700", "#1b2c45");
    root.style.setProperty("--color-navy-900", "#0b131e");

    root.style.setProperty("--color-sidebar-bg", settings.secondaryColor);
    root.style.setProperty("--color-sidebar-hover", settings.secondaryColor + "dd");
    root.style.setProperty("--color-sidebar-border", settings.secondaryColor + "40");
    root.style.setProperty("--color-sidebar-text", settings.sidebarTextColor);

    root.style.setProperty("--color-ink", settings.fontColor);
    root.style.setProperty("--color-foreground", settings.fontColor);
    root.style.setProperty("--foreground", settings.fontColor);

    let radiusValue = "14px";
    if (settings.borderRadius === "none") radiusValue = "0px";
    else if (settings.borderRadius === "full") radiusValue = "22px";

    root.style.setProperty("--radius", radiusValue);
    root.style.setProperty("--radius-sm", radiusValue === "0px" ? "0px" : "8px");
    root.style.setProperty("--radius-md", radiusValue);

    root.style.setProperty(
      "--font-sans",
      `"${settings.fontFamily}", var(--font-hanken), system-ui, sans-serif`,
    );

    const fontId = `google-font-${settings.fontFamily}`;
    if (!document.getElementById(fontId)) {
      const link = document.createElement("link");
      link.id = fontId;
      link.rel = "stylesheet";
      link.href = `https://fonts.googleapis.com/css2?family=${settings.fontFamily}:wght@300;400;500;600;700&display=swap`;
      document.head.appendChild(link);
    }
  }, [settings]);

  return { settings, setSettings, hydrateSettings, resetSettings };
}
