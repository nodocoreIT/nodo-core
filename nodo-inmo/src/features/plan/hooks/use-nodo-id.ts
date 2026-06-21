import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@nodocore/shared-components";
import { supabase } from "@/shared/lib/supabase";

export const NODO_ID_QUERY_KEY = ["nodo-inmo", "nodo-id"] as const;

const INMO_PRODUCT = "inmo";

async function fetchNodoId(orgId: string) {
  const { data, error } = await supabase
    .schema("shared")
    .from("nodo_id")
    .select("id, org_id, product, created_at")
    .eq("org_id", orgId)
    .eq("product", INMO_PRODUCT)
    .maybeSingle();

  if (error) throw error;
  return data;
}

/**
 * Reads the org's Nodo ID key from shared.nodo_id (Pro feature).
 * Row is created server-side when the org is on Plan Pro.
 */
export function useNodoId() {
  const { orgId, plan } = useAuth();
  const queryClient = useQueryClient();

  return useQuery({
    queryKey: [...NODO_ID_QUERY_KEY, orgId],
    queryFn: async () => {
      if (!orgId) {
        // JWT may be stale right after login — refresh once then retry.
        const { data: refreshed, error: refreshErr } = await supabase.auth.refreshSession();
        if (refreshErr) throw refreshErr;
        const refreshedOrgId = refreshed.session?.user.app_metadata?.org_id as string | undefined;
        if (!refreshedOrgId) return null;
        return fetchNodoId(refreshedOrgId);
      }
      try {
        return await fetchNodoId(orgId);
      } catch (firstErr) {
        const { data: refreshed, error: refreshErr } = await supabase.auth.refreshSession();
        if (refreshErr) throw firstErr;
        const refreshedOrgId = refreshed.session?.user.app_metadata?.org_id as string | undefined;
        if (!refreshedOrgId) throw firstErr;
        const row = await fetchNodoId(refreshedOrgId);
        void queryClient.invalidateQueries({ queryKey: NODO_ID_QUERY_KEY });
        return row;
      }
    },
    enabled: plan === "pro",
    staleTime: 60_000,
    retry: 1,
  });
}
