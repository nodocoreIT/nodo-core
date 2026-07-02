"use client";

import { useEffect } from "react";
import { create } from "zustand";
import {
  DEFAULT_THEME_SETTINGS,
  mergeThemeSettings,
  PATIENT_THEME_SETTINGS,
  type DoctorThemeSettings,
} from "@/lib/clinic/theme-settings";

export type ThemeSettings = DoctorThemeSettings;
export const DEFAULT_SETTINGS = DEFAULT_THEME_SETTINGS;

const MEDICO_THEME_STORAGE_KEY = "nodo-theme-medico";

interface ThemeStore {
  settings: DoctorThemeSettings;
  hydrated: boolean;
  setSettings: (newSettings: Partial<DoctorThemeSettings>) => void;
  hydrateSettings: (settings: Partial<DoctorThemeSettings>) => void;
  resetSettings: () => void;
}

const persistMedicoLocal = (settings: DoctorThemeSettings) => {
  try {
    localStorage.setItem(MEDICO_THEME_STORAGE_KEY, JSON.stringify(settings));
  } catch {
    /* ignore */
  }
};

const getMedicoStoredSettings = (): DoctorThemeSettings | null => {
  if (typeof window === "undefined") return null;
  try {
    const stored = localStorage.getItem(MEDICO_THEME_STORAGE_KEY);
    if (stored) return mergeThemeSettings(JSON.parse(stored));
  } catch {
    /* ignore */
  }
  return null;
};

export function applyThemeToDocument(settings: DoctorThemeSettings): void {
  if (typeof document === "undefined") return;

  const root = document.documentElement;

  root.style.setProperty("--color-brand", settings.primaryColor);
  root.style.setProperty("--color-brand-600", settings.primaryColor);
  root.style.setProperty("--color-brand-300", settings.primaryColor + "99");
  root.style.setProperty("--color-ring", settings.primaryColor);
  root.style.setProperty("--color-primary-foreground", settings.buttonFontColor);
  root.style.setProperty("--color-primary", settings.primaryColor);
  root.style.setProperty("--primary", settings.primaryColor);
  root.style.setProperty("--primary-foreground", settings.buttonFontColor);
  root.style.setProperty("--ring", settings.primaryColor);

  root.style.setProperty("--color-navy", settings.secondaryColor);
  root.style.setProperty("--color-navy-700", settings.secondaryColor);
  root.style.setProperty("--color-navy-900", settings.secondaryColor);

  root.style.setProperty("--color-sidebar-bg", settings.secondaryColor);
  root.style.setProperty("--color-sidebar-hover", settings.secondaryColor + "dd");
  root.style.setProperty("--color-sidebar-border", settings.secondaryColor + "40");
  root.style.setProperty("--color-sidebar-text", settings.sidebarTextColor);
  root.style.setProperty("--sidebar", settings.secondaryColor);
  root.style.setProperty("--sidebar-foreground", settings.sidebarTextColor);
  root.style.setProperty("--sidebar-primary", settings.primaryColor);
  root.style.setProperty("--sidebar-primary-foreground", settings.buttonFontColor);
  root.style.setProperty("--sidebar-ring", settings.primaryColor);
  root.style.setProperty("--color-sidebar-accent", settings.primaryColor + "1a");
  root.style.setProperty("--sidebar-accent", settings.primaryColor + "1a");
  root.style.setProperty("--sidebar-accent-foreground", settings.primaryColor);

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
}

export const useThemeStore = create<ThemeStore>((set) => ({
  settings: DEFAULT_THEME_SETTINGS,
  hydrated: false,
  setSettings: (newSettings) =>
    set((state) => {
      const next = mergeThemeSettings({ ...state.settings, ...newSettings });
      persistMedicoLocal(next);
      applyThemeToDocument(next);
      return { settings: next, hydrated: true };
    }),
  hydrateSettings: (newSettings) =>
    set(() => {
      const next = mergeThemeSettings(newSettings);
      persistMedicoLocal(next);
      applyThemeToDocument(next);
      return { settings: next, hydrated: true };
    }),
  resetSettings: () => {
    try {
      localStorage.removeItem(MEDICO_THEME_STORAGE_KEY);
    } catch {
      /* ignore */
    }
    const next = DEFAULT_THEME_SETTINGS;
    applyThemeToDocument(next);
    set({ settings: next, hydrated: true });
  },
}));

export function configureThemeDefaults(overrides: Partial<DoctorThemeSettings>): void {
  if (typeof window === "undefined") return;
  if (!getMedicoStoredSettings()) {
    const merged = mergeThemeSettings(overrides);
    useThemeStore.setState({ settings: merged });
  }
}

/** Tema del consultorio médico (localStorage + API). */
export function useThemeSettings() {
  const { settings, setSettings, hydrateSettings, resetSettings } = useThemeStore();

  useEffect(() => {
    if (useThemeStore.getState().hydrated) return;
    const stored = getMedicoStoredSettings();
    const next = stored ?? DEFAULT_THEME_SETTINGS;
    useThemeStore.setState({ settings: next, hydrated: true });
    applyThemeToDocument(next);
  }, []);

  return { settings, setSettings, hydrateSettings, resetSettings };
}

/** Tema fijo del portal paciente. */
export function usePatientTheme() {
  useEffect(() => {
    applyThemeToDocument(PATIENT_THEME_SETTINGS);
  }, []);
}
