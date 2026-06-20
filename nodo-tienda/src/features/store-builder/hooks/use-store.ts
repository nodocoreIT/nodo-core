import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@nodocore/shared-components";
import { supabase } from "@/shared/lib/supabase";
import type { StoreRow } from "@/shared/types/database";

export type { StoreRow };

export const STORE_QK = ["nodo_tienda", "store"] as const;

export function useStore() {
  const { orgId } = useAuth();
  return useQuery<StoreRow | null>({
    queryKey: [...STORE_QK, orgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .schema("nodo_tienda")
        .from("stores")
        .select("*")
        .eq("org_id", orgId!)
        .maybeSingle();
      if (error) throw error;
      return data ?? null;
    },
    enabled: !!orgId,
    staleTime: 60_000,
  });
}

export function useUpdateStore() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (values: Partial<StoreRow> & { id: string }) => {
      const { id, ...rest } = values;
      const { data, error } = await supabase
        .schema("nodo_tienda")
        .from("stores")
        .update(rest)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: STORE_QK }),
  });
}

export function useSetCustomDomain() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ storeId, domain }: { storeId: string; domain: string }) => {
      const token = domain ? crypto.randomUUID().replace(/-/g, "") : null;
      const { error } = await supabase
        .schema("nodo_tienda")
        .from("stores")
        .update({
          custom_domain: domain || null,
          domain_verify_token: token,
          domain_verified_at: null,
        })
        .eq("id", storeId);
      if (error) throw error;
      return { token };
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: STORE_QK }),
  });
}
