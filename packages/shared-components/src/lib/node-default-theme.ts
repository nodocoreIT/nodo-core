import type { ThemeSettings } from "../hooks/use-theme-settings";

const BASE_THEME: Omit<ThemeSettings, "primaryColor" | "brandText"> = {
  secondaryColor: "#121e2f",
  sidebarTextColor: "#9dacbe",
  fontColor: "#16202e",
  buttonFontColor: "#ffffff",
  borderRadius: "md",
  fontFamily: "Inter",
  logoType: "default",
};

/** Canonical default theme per dashboard unit code (source of truth for provisioning). */
export const NODE_DEFAULT_THEMES: Record<string, ThemeSettings> = {
  Inmo: {
    ...BASE_THEME,
    primaryColor: "#da5a0e",
    brandText: "nodo inmo",
  },
  Autos: {
    ...BASE_THEME,
    primaryColor: "#C41E3A",
    brandText: "nodo autos",
  },
  Finanzas: {
    ...BASE_THEME,
    primaryColor: "#059669",
    sidebarTextColor: "#9dbdb4",
    fontColor: "#0a1a14",
    secondaryColor: "#0d1f2d",
    brandText: "nodo finanzas",
  },
  Clínica: {
    ...BASE_THEME,
    primaryColor: "#da5a0e",
    brandText: "nodo salud",
  },
  Salud: {
    ...BASE_THEME,
    primaryColor: "#da5a0e",
    brandText: "nodo salud",
  },
  Tienda: {
    ...BASE_THEME,
    primaryColor: "#6366f1",
    sidebarTextColor: "#a5b4fc",
    brandText: "nodo tienda",
  },
};

export function getNodeDefaultTheme(unitCode: string): ThemeSettings {
  return (
    NODE_DEFAULT_THEMES[unitCode] ??
    NODE_DEFAULT_THEMES.Inmo
  );
}

export function isEmptyThemeSettings(value: unknown): boolean {
  if (value == null) return true;
  if (typeof value !== "object") return true;
  return Object.keys(value as object).length === 0;
}

export function mergeThemeSettings(
  stored: unknown,
  defaults: ThemeSettings,
): ThemeSettings {
  if (!isEmptyThemeSettings(stored) && typeof stored === "object") {
    return { ...defaults, ...(stored as Partial<ThemeSettings>) };
  }
  return { ...defaults };
}

export type { ThemeSettings };
