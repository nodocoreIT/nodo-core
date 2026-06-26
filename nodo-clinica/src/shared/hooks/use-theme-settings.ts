"use client";

/**
 * Scaffold-compliant theme settings hook for nodo-clinica.
 * Follows the nodo-scaffold pattern: Zustand store + CSS custom properties on :root.
 * Storage key and brandText are nodo-clinica-specific.
 *
 * This is the canonical hook for the medico portal theme.
 * Use this from ThemeInitializer (providers) and the settings dialog.
 */
import { useEffect } from "react";
import { create } from "zustand";

export interface ThemeSettings {
  primaryColor: string;
  secondaryColor: string;
  sidebarTextColor: string;
  fontColor: string;
  buttonFontColor: string;
  borderRadius: "none" | "md" | "full";
  fontFamily: "Inter" | "Roboto" | "Montserrat";
  logoType: "default" | "custom" | "text";
  brandText: string;
}

// Unique localStorage key for nodo-clinica (required by nodo-scaffold convention).
const STORAGE_KEY = "nodo-clinica-theme-settings";

export const DEFAULT_SETTINGS: ThemeSettings = {
  primaryColor: "#da5a0e",
  secondaryColor: "#121e2f",
  sidebarTextColor: "#9dacbe",
  fontColor: "#16202e",
  buttonFontColor: "#ffffff",
  borderRadius: "md",
  fontFamily: "Inter",
  logoType: "default",
  brandText: "nodo clinica",
};

interface ThemeStore {
  settings: ThemeSettings;
  setSettings: (newSettings: Partial<ThemeSettings>) => void;
  resetSettings: () => void;
}

const getInitialSettings = (): ThemeSettings => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return { ...DEFAULT_SETTINGS, ...JSON.parse(stored) };
    }
  } catch {
    // Ignored
  }
  return DEFAULT_SETTINGS;
};

export const useThemeStore = create<ThemeStore>((set) => ({
  settings: typeof window !== "undefined" ? getInitialSettings() : DEFAULT_SETTINGS,
  setSettings: (newSettings) =>
    set((state) => {
      const next = { ...state.settings, ...newSettings };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        // Ignored
      }
      return { settings: next };
    }),
  resetSettings: () => {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Ignored
    }
    set({ settings: DEFAULT_SETTINGS });
  },
}));

/**
 * Applies the Zustand store values as CSS custom properties on :root.
 * Call this inside ThemeInitializer (which must be inside AuthProvider).
 */
export function useThemeSettings() {
  const { settings, setSettings, resetSettings } = useThemeStore();

  useEffect(() => {
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
    root.style.setProperty("--sidebar", settings.secondaryColor);
    root.style.setProperty("--sidebar-foreground", settings.sidebarTextColor);
    root.style.setProperty("--sidebar-primary", settings.primaryColor);
    root.style.setProperty("--sidebar-primary-foreground", settings.buttonFontColor);
    root.style.setProperty("--sidebar-ring", settings.primaryColor);

    root.style.setProperty("--color-sidebar-bg", settings.secondaryColor);
    root.style.setProperty("--color-sidebar-hover", settings.secondaryColor + "dd");
    root.style.setProperty("--color-sidebar-border", settings.secondaryColor + "40");
    root.style.setProperty("--color-sidebar-text", settings.sidebarTextColor);
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
  }, [settings]);

  return { settings, setSettings, resetSettings };
}
