import { useEffect } from "react";
import { autosDb } from "@/shared/lib/supabase";
import { useThemeStore, type ThemeSettings } from "./use-theme-settings";

export function useAutosThemeSync() {
  const { setSettings } = useThemeStore();

  useEffect(() => {
    autosDb()
      .from("clientes")
      .select("theme_settings")
      .maybeSingle()
      .then(({ data }) => {
        if (data?.theme_settings && typeof data.theme_settings === "object") {
          setSettings(data.theme_settings as Partial<ThemeSettings>);
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
