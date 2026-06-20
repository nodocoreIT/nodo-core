import { useEffect, useState } from "react";
import { useSupabase } from "@nodocore/shared-components";
import type { OrgEntry } from "./types";

export function useMyOrgs() {
  const supabase = useSupabase();
  const [orgs, setOrgs] = useState<OrgEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

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
  }, [supabase]);

  return { orgs, loading, error };
}
