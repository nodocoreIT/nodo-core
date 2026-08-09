"use client";
import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSupabase } from "@nodocore/shared-components";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { OrgEntry } from "./types";

/**
 * Shared across every mount point that renders NodoSwitcher/guest-dashboard
 * simultaneously — without a shared cache, each one fired its own
 * get_my_orgs request (seen in production: 5 duplicate calls on a single
 * page load). react-query dedupes concurrent calls with the same key and
 * caches the result for staleTime, so N consumers mounted at once only
 * cost one network round trip.
 */
const MY_ORGS_QUERY_KEY = ["my-orgs"] as const;

async function fetchMyOrgs(supabase: SupabaseClient<any, any>): Promise<OrgEntry[]> {
  // get_my_orgs lives in the public schema. Nodos whose client is scoped to
  // another schema (e.g. clinica → nodo_clinica) would otherwise 404 looking
  // for the function in the wrong schema — same pattern as verify-node-access.ts.
  const { data, error } = await supabase.schema("public").rpc("get_my_orgs");
  if (error) throw new Error(error.message);
  return (data as OrgEntry[]) ?? [];
}

export function useMyOrgs() {
  const supabase = useSupabase();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: MY_ORGS_QUERY_KEY,
    queryFn: () => fetchMyOrgs(supabase),
    staleTime: 60_000,
  });

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: MY_ORGS_QUERY_KEY });
  };

  // Re-fetch when the org changes.
  useEffect(() => {
    window.addEventListener("nodo:org-switched", refresh);
    return () => window.removeEventListener("nodo:org-switched", refresh);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    orgs: query.data ?? [],
    loading: query.isLoading,
    error: query.error,
    refresh,
  };
}
