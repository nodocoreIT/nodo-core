import { useQueryClient, useMutation } from "@tanstack/react-query";
import { useAuth } from "@nodocore/shared-components";
import { supabase } from "@/shared/lib/supabase";
import { useThemeStore } from "@/shared/hooks/use-theme-settings";
import type { ThemeSettings } from "@/shared/hooks/use-theme-settings";
import { ORG_PROFILE_QUERY_KEY } from "@/features/store-profile/hooks/use-org-profile";

export function useUpdateTheme() {
  const qc = useQueryClient();
  const { orgId } = useAuth();
  const { setSettings } = useThemeStore();

  return useMutation({
    mutationFn: async ({
      profileId,
      theme,
    }: {
      profileId: string;
      theme: ThemeSettings;
    }) => {
      const { error } = await supabase
        .schema("nodo_tienda")
        .from("org_profiles")
        .update({ theme_settings: theme })
        .eq("id", profileId);
      if (error) throw error;
      return theme;
    },
    onSuccess: (theme) => {
      setSettings(theme);
      qc.invalidateQueries({ queryKey: [...ORG_PROFILE_QUERY_KEY, orgId] });
    },
  });
}
