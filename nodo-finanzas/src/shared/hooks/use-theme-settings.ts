import { useEffect } from "react";
import { create } from "zustand";

function blendWithWhite(hex: string, ratio: number): string {
  if (!/^#[0-9A-Fa-f]{6}$/.test(hex)) return "#dcfce7";
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const br = Math.round(r * ratio + 255 * (1 - ratio));
  const bg = Math.round(g * ratio + 255 * (1 - ratio));
  const bb = Math.round(b * ratio + 255 * (1 - ratio));
  return `#${br.toString(16).padStart(2, "0")}${bg.toString(16).padStart(2, "0")}${bb.toString(16).padStart(2, "0")}`;
}

function darkenColor(hex: string, factor: number = 0.82): string {
  if (!/^#[0-9A-Fa-f]{6}$/.test(hex)) return hex;
  const r = Math.min(255, Math.round(parseInt(hex.slice(1, 3), 16) * factor));
  const g = Math.min(255, Math.round(parseInt(hex.slice(3, 5), 16) * factor));
  const b = Math.min(255, Math.round(parseInt(hex.slice(5, 7), 16) * factor));
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
}

export interface ThemeSettings {
  primaryColor: string;
  secondaryColor: string;
  sidebarTextColor: string;
  fontColor: string;
  buttonFontColor: string;
  backgroundColor: string;
  borderRadius: "none" | "md" | "full";
  fontFamily: "Inter" | "Roboto" | "Montserrat";
  logoType: "default" | "custom" | "text";
  brandText: string;
}

export const DEFAULT_SETTINGS: ThemeSettings = {
  primaryColor: "#059669",
  secondaryColor: "#0d1f2d",
  sidebarTextColor: "#9dbdb4",
  fontColor: "#0a1a14",
  buttonFontColor: "#ffffff",
  backgroundColor: "#f0fdf4",
  borderRadius: "md",
  fontFamily: "Inter",
  logoType: "default",
  brandText: "nodo finanzas",
};

interface ThemeStore {
  settings: ThemeSettings;
  setSettings: (newSettings: Partial<ThemeSettings>) => void;
  resetSettings: () => void;
}

const STORAGE_KEY = "nodo-finanzas-theme-settings";

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
  settings: getInitialSettings(),
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

export function useThemeSettings() {
  const { settings, setSettings, resetSettings } = useThemeStore();

  useEffect(() => {
    const root = document.documentElement;

    // Apply primary color
    root.style.setProperty("--color-brand", settings.primaryColor);
    root.style.setProperty("--color-brand-dark", darkenColor(settings.primaryColor, 0.82));
    root.style.setProperty("--color-brand-600", settings.primaryColor + "e0");
    root.style.setProperty("--color-brand-300", settings.primaryColor + "60");
    root.style.setProperty("--color-ring", settings.primaryColor);
    root.style.setProperty("--color-primary-foreground", settings.buttonFontColor);
    root.style.setProperty("--color-primary", settings.primaryColor);

    // Keep standard navy colors stable for main app headers and titles
    root.style.setProperty("--color-navy", "#0d1f2d");
    root.style.setProperty("--color-navy-700", "#1a3347");
    root.style.setProperty("--color-navy-900", "#0d1f2d");

    // Apply sidebar custom colors
    root.style.setProperty("--color-sidebar-bg", settings.secondaryColor);
    root.style.setProperty("--color-sidebar-hover", settings.secondaryColor + "dd");
    root.style.setProperty("--color-sidebar-border", settings.secondaryColor + "40");

    // Apply sidebar unselected text color
    root.style.setProperty("--color-sidebar-text", settings.sidebarTextColor);

    // Apply font color (body text)
    root.style.setProperty("--color-ink", settings.fontColor);
    root.style.setProperty("--color-foreground", settings.fontColor);

    // Apply background color
    const bg = settings.backgroundColor ?? "#f0fdf4";
    root.style.setProperty("--color-paper", bg);
    root.style.setProperty("--color-background", bg);

    // Derive mist and mist-200 from primary color
    root.style.setProperty("--color-mist", blendWithWhite(settings.primaryColor, 0.15));
    root.style.setProperty("--color-mist-200", blendWithWhite(settings.primaryColor, 0.08));

    // Apply border radius
    let radiusValue = "14px"; // md / default
    if (settings.borderRadius === "none") {
      radiusValue = "0px";
    } else if (settings.borderRadius === "full") {
      radiusValue = "22px";
    }
    root.style.setProperty("--radius", radiusValue);
    root.style.setProperty("--radius-sm", radiusValue === "0px" ? "0px" : "8px");
    root.style.setProperty("--radius-md", radiusValue);

    // Apply font family
    root.style.setProperty("--font-sans", `"${settings.fontFamily}", system-ui, sans-serif`);

    // Inject google fonts dynamically if not loaded
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
