import { useEffect } from "react";
import { isEmptyThemeSettings, mergeThemeSettings } from "@nodocore/shared-components";
import { supabase } from "@/shared/lib/supabase";
import { useThemeStore, DEFAULT_SETTINGS, type ThemeSettings } from "./use-theme-settings";

/**
 * Loads theme from Auth app_metadata (seeded at dashboard provisioning) or
 * falls back to the nodo Finanzas defaults in localStorage.
 */
export function useFinanzasThemeSync() {
  const { setSettings } = useThemeStore();

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      const metaTheme = data.session?.user.app_metadata?.theme_settings;
      if (!isEmptyThemeSettings(metaTheme)) {
        setSettings(mergeThemeSettings(metaTheme, DEFAULT_SETTINGS));
      }
    });
  }, [setSettings]);
}

export async function saveFinanzasThemeSettings(_settings: ThemeSettings): Promise<void> {
  // Finanzas theme customizations persist in localStorage; provisioning seeds app_metadata.
}
