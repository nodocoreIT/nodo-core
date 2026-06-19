import { useEffect } from "react";
import { isEmptyThemeSettings, mergeThemeSettings } from "@nodocore/shared-components";
import { autosDb } from "@/shared/lib/supabase";
import { useThemeStore, DEFAULT_SETTINGS, type ThemeSettings } from "./use-theme-settings";

export function useAutosThemeSync() {
  const { setSettings } = useThemeStore();

  useEffect(() => {
    autosDb()
      .from("clientes")
      .select("theme_settings")
      .maybeSingle()
      .then(async ({ data }) => {
        const theme = mergeThemeSettings(data?.theme_settings, DEFAULT_SETTINGS);
        setSettings(theme);

        if (!data?.theme_settings || isEmptyThemeSettings(data.theme_settings)) {
          await saveAutosThemeSettings(theme);
        }
      });
  }, [setSettings]);
}

export async function saveAutosThemeSettings(settings: ThemeSettings): Promise<void> {
  await autosDb()
    .from("clientes")
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .update({ theme_settings: settings as any });
}
