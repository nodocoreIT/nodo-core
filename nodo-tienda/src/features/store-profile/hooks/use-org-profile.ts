import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/shared/lib/supabase";
import { useAuth } from "@nodocore/shared-components";
import type { OrgProfileRow } from "@/shared/types/database";

export const ORG_PROFILE_QUERY_KEY = ["tienda", "org-profile"] as const;

/**
 * Fetch the org profile for the authenticated admin's org.
 * Returns null (not an error) when the org has not yet filled its profile —
 * missing profile is a valid first-run state.
 */
export function useOrgProfile() {
  const { orgId } = useAuth();

  return useQuery<OrgProfileRow | null>({
    queryKey: [...ORG_PROFILE_QUERY_KEY, orgId],
    queryFn: async () => {
      if (!orgId) return null;

      const { data, error } = await supabase
        .schema("nodo_tienda")
        .from("org_profiles")
        .select("*")
        .eq("org_id", orgId)
        .maybeSingle();

      if (error) throw error;
      return data ?? null;
    },
    enabled: !!orgId,
    staleTime: 30_000,
  });
}
