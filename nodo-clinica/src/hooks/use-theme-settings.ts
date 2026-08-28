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
const PACIENTE_THEME_STORAGE_KEY = "nodo-theme-paciente";

interface ThemeStore {
  settings: DoctorThemeSettings;
  hydrated: boolean;
  setSettings: (newSettings: Partial<DoctorThemeSettings>) => void;
  hydrateSettings: (settings: Partial<DoctorThemeSettings>) => void;
  resetSettings: () => void;
}

function normalizeThemeSettings(
  stored: Partial<DoctorThemeSettings>,
): DoctorThemeSettings {
  const merged = mergeThemeSettings(stored);
  const isStandardClinicText =
    merged.logoType === "text" &&
    merged.brandText.trim().toLowerCase() === "nodo clínica".toLowerCase();
  if (isStandardClinicText) {
    return mergeThemeSettings({ ...merged, logoType: "default" });
  }
  return merged;
}

function getStoredSettings(storageKey: string): DoctorThemeSettings | null {
  if (typeof window === "undefined") return null;
  try {
    const stored = localStorage.getItem(storageKey);
    if (stored) return normalizeThemeSettings(JSON.parse(stored));
  } catch {
    /* ignore */
  }
  return null;
}

const THEME_CSS_PROPERTIES = [
  "--color-brand",
  "--color-brand-600",
  "--color-brand-300",
  "--color-ring",
  "--color-primary-foreground",
  "--color-primary",
  "--primary",
  "--primary-foreground",
  "--ring",
  "--color-navy",
  "--color-navy-700",
  "--color-navy-900",
  "--color-sidebar-bg",
  "--color-sidebar-hover",
  "--color-sidebar-border",
  "--color-sidebar-text",
  "--sidebar",
  "--sidebar-foreground",
  "--sidebar-primary",
  "--sidebar-primary-foreground",
  "--sidebar-ring",
  "--color-sidebar-accent",
  "--sidebar-accent",
  "--sidebar-accent-foreground",
  "--color-ink",
  "--color-foreground",
  "--foreground",
  "--radius",
  "--radius-sm",
  "--radius-md",
  "--font-sans",
];

/** Quita cualquier variable CSS de tema que haya quedado seteada inline en
 * <html> por applyThemeToDocument() (persiste entre navegaciones SPA, ya
 * que se escribe directo en document.documentElement.style). Usado en
 * páginas que NUNCA deben reflejar la personalización del médico/paciente
 * — ej. /login — para que vuelvan a usar el branding institucional fijo
 * definido en globals.css, sin importar qué tema haya quedado aplicado de
 * una sesión anterior en el mismo navegador. */
export function resetThemeToDocument(): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  for (const prop of THEME_CSS_PROPERTIES) {
    root.style.removeProperty(prop);
  }
}

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

/** Crea un store de tema independiente, persistido bajo su propia clave de
 * localStorage — usado para que médico y paciente tengan cada uno su propia
 * personalización sin pisarse entre sí (comparten el mismo navegador cuando
 * el mismo usuario tiene ambos roles). */
function createThemeStore(storageKey: string, defaultSettings: DoctorThemeSettings) {
  const persistLocal = (settings: DoctorThemeSettings) => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(settings));
    } catch {
      /* ignore */
    }
  };

  return create<ThemeStore>((set) => ({
    settings: defaultSettings,
    hydrated: false,
    setSettings: (newSettings) =>
      set((state) => {
        const next = mergeThemeSettings({ ...state.settings, ...newSettings });
        persistLocal(next);
        applyThemeToDocument(next);
        return { settings: next, hydrated: true };
      }),
    hydrateSettings: (newSettings) =>
      set(() => {
        const next = mergeThemeSettings(newSettings);
        persistLocal(next);
        applyThemeToDocument(next);
        return { settings: next, hydrated: true };
      }),
    resetSettings: () => {
      try {
        localStorage.removeItem(storageKey);
      } catch {
        /* ignore */
      }
      applyThemeToDocument(defaultSettings);
      set({ settings: defaultSettings, hydrated: true });
    },
  }));
}

export const useThemeStore = createThemeStore(MEDICO_THEME_STORAGE_KEY, DEFAULT_THEME_SETTINGS);
export const usePatientThemeStore = createThemeStore(
  PACIENTE_THEME_STORAGE_KEY,
  PATIENT_THEME_SETTINGS,
);

export function configureThemeDefaults(overrides: Partial<DoctorThemeSettings>): void {
  if (typeof window === "undefined") return;
  if (!getStoredSettings(MEDICO_THEME_STORAGE_KEY)) {
    const merged = mergeThemeSettings(overrides);
    useThemeStore.setState({ settings: merged });
  }
}

/** Tema del consultorio médico (localStorage + API). */
export function useThemeSettings() {
  const { settings, setSettings, hydrateSettings, resetSettings } = useThemeStore();

  useEffect(() => {
    if (useThemeStore.getState().hydrated) return;
    const stored = getStoredSettings(MEDICO_THEME_STORAGE_KEY);
    const next = stored ?? DEFAULT_THEME_SETTINGS;
    useThemeStore.setState({ settings: next, hydrated: true });
    applyThemeToDocument(next);
  }, []);

  return { settings, setSettings, hydrateSettings, resetSettings };
}

/** Tema institucional FIJO — usado por el <ThemeProvider> global (envuelve
 * TODA la app: landing pública, /login, y cualquier página sin sesión).
 * A propósito NO lee ninguna personalización guardada — el login y las
 * páginas públicas nunca deben reflejar el color que un médico o paciente
 * eligió para su propio portal. La personalización real del paciente
 * logueado se aplica aparte, en el layout del portal (ver
 * usePatientThemeSettings), que corre DESPUÉS de este por estar más
 * adentro en el árbol y gana la carrera de efectos. */
export function usePatientTheme() {
  useEffect(() => {
    applyThemeToDocument(PATIENT_THEME_SETTINGS);
  }, []);
}

/** Personalización del tema del portal paciente (usado por la sección
 * "Personalización" dentro de Configuración del paciente) — separado del
 * hook de médico para no compartir su store/localStorage. */
export function usePatientThemeSettings() {
  const { settings, setSettings, hydrateSettings, resetSettings } = usePatientThemeStore();

  useEffect(() => {
    if (usePatientThemeStore.getState().hydrated) return;
    const stored = getStoredSettings(PACIENTE_THEME_STORAGE_KEY);
    const next = stored ?? PATIENT_THEME_SETTINGS;
    usePatientThemeStore.setState({ settings: next, hydrated: true });
    applyThemeToDocument(next);
  }, []);

  return { settings, setSettings, hydrateSettings, resetSettings };
}
