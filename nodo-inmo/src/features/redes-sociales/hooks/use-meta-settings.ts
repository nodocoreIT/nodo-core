import { useOrgProfile } from "@/features/agency-profile/hooks/use-org-profile";
import type { MetaSettings } from "@nodocore/nodo-modules/settings";

/**
 * Returns the meta_settings from the org profile, or null if not configured.
 * The value is typed as MetaSettings; the DB stores it as Json (jsonb).
 */
export function useMetaSettings(): MetaSettings | null {
  const { data: profile } = useOrgProfile();

  if (!profile?.meta_settings) return null;

  return profile.meta_settings as unknown as MetaSettings;
}
