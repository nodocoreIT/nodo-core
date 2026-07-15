"use client";
import { useCallback, useEffect, useState } from "react";
import { useSupabase } from "@nodocore/shared-components";
import type { OrgEntry } from "./types";

export function useMyOrgs() {
  const supabase = useSupabase();
  const [orgs, setOrgs] = useState<OrgEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const refresh = useCallback(() => setRefreshKey((k) => k + 1), []);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const { data, error: rpcError } = await supabase.rpc("get_my_orgs");
        if (cancelled) return;
        if (rpcError) {
          setError(new Error(rpcError.message));
        } else {
          setOrgs((data as OrgEntry[]) ?? []);
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err : new Error(String(err)));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [supabase, refreshKey]);

  // Re-fetch when the org changes.
  useEffect(() => {
    const handler = () => refresh();
    window.addEventListener("nodo:org-switched", handler);
    return () => window.removeEventListener("nodo:org-switched", handler);
  }, [refresh]);

  return { orgs, loading, error, refresh };
}
