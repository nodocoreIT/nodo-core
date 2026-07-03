import { useEffect } from "react";
import type { ThemeSettings } from "@nodocore/nodo-modules/settings";

export const PANEL_DEFAULT_THEME: ThemeSettings = {
  primaryColor: "#DA5A0E",
  secondaryColor: "#121e2f",
  sidebarTextColor: "#9dacbe",
  fontColor: "#16202e",
  buttonFontColor: "#ffffff",
  borderRadius: "md",
  fontFamily: "Inter",
  logoType: "default",
  brandText: "nodo dashboard",
  backgroundColor: "#f0fdf4",
};

const STORAGE_KEY = "nodo-panel-theme-settings";

export function readPanelThemeFromStorage(): ThemeSettings {
  if (typeof window === "undefined") return PANEL_DEFAULT_THEME;
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return { ...PANEL_DEFAULT_THEME, ...JSON.parse(stored) };
  } catch {
    // ignore
  }
  return PANEL_DEFAULT_THEME;
}

export function persistPanelThemeToStorage(settings: ThemeSettings) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // ignore
  }
}

export function applyPanelThemeToDocument(settings: ThemeSettings) {
  const root = document.documentElement;
  root.style.setProperty("--color-brand", settings.primaryColor);
  root.style.setProperty("--color-brand-600", settings.primaryColor + "e0");
  root.style.setProperty("--color-brand-300", settings.primaryColor + "60");
  root.style.setProperty("--color-ring", settings.primaryColor);
  root.style.setProperty("--color-primary-foreground", settings.buttonFontColor);
  root.style.setProperty("--color-primary", settings.primaryColor);
  root.style.setProperty("--color-navy", "#121e2f");
  root.style.setProperty("--color-navy-700", "#1b2c45");
  root.style.setProperty("--color-navy-900", "#0b131e");
  root.style.setProperty("--color-sidebar-bg", settings.secondaryColor);
  root.style.setProperty("--color-sidebar-hover", settings.secondaryColor + "dd");
  root.style.setProperty("--color-sidebar-border", settings.secondaryColor + "40");
  root.style.setProperty("--color-sidebar-text", settings.sidebarTextColor);
  root.style.setProperty("--color-ink", settings.fontColor);
  root.style.setProperty("--color-foreground", settings.fontColor);

  let radiusValue = "14px";
  if (settings.borderRadius === "none") radiusValue = "0px";
  else if (settings.borderRadius === "full") radiusValue = "22px";
  root.style.setProperty("--radius", radiusValue);
  root.style.setProperty("--radius-sm", radiusValue === "0px" ? "0px" : "8px");
  root.style.setProperty("--radius-md", radiusValue);
  root.style.setProperty("--font-sans", `"${settings.fontFamily}", system-ui, sans-serif`);

  const fontId = `google-font-${settings.fontFamily}`;
  if (!document.getElementById(fontId)) {
    const link = document.createElement("link");
    link.id = fontId;
    link.rel = "stylesheet";
    link.href = `https://fonts.googleapis.com/css2?family=${settings.fontFamily}:wght@300;400;500;600;700&display=swap`;
    document.head.appendChild(link);
  }
}

export function useApplyPanelTheme(settings: ThemeSettings) {
  useEffect(() => {
    applyPanelThemeToDocument(settings);
  }, [settings]);
}
