import { useEffect } from "react";
import { supabase } from "@/shared/lib/supabase";
import { useThemeStore, type ThemeSettings } from "./use-theme-settings";

export function useClinicaThemeSync() {
  const { setSettings } = useThemeStore();

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return;
      const { data } = await supabase
        .from("profiles")
        .select("theme_settings")
        .eq("id", user.id)
        .single();
      if (data?.theme_settings && typeof data.theme_settings === "object") {
        setSettings(data.theme_settings as Partial<ThemeSettings>);
      }
    });
  }, [setSettings]);
}

export async function saveClinicaThemeSettings(settings: ThemeSettings): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;
  await supabase
    .from("profiles")
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .update({ theme_settings: settings as any })
    .eq("id", user.id);
}
