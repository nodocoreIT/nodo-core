import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@nodocore/shared-components";
import { supabase } from "@/shared/lib/supabase";

export type MenuItem = { label: string; url: string };
export type MenuLocation = "header" | "footer";

export type StoreMenuRow = {
  id: string;
  org_id: string;
  location: MenuLocation;
  items: MenuItem[];
};

export const MENUS_QK = ["nodo_tienda", "store_menus"] as const;

export function useStoreMenus() {
  const { orgId } = useAuth();
  return useQuery<StoreMenuRow[]>({
    queryKey: [...MENUS_QK, orgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .schema("nodo_tienda")
        .from("store_menus")
        .select("*")
        .eq("org_id", orgId!);
      if (error) throw error;
      return (data ?? []) as StoreMenuRow[];
    },
    enabled: !!orgId,
    staleTime: 60_000,
  });
}

export function useUpsertStoreMenu() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      location,
      items,
      orgId,
    }: {
      location: MenuLocation;
      items: MenuItem[];
      orgId: string;
    }) => {
      const { error } = await supabase
        .schema("nodo_tienda")
        .from("store_menus")
        .upsert(
          { org_id: orgId, location, items },
          { onConflict: "org_id,location" },
        );
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: MENUS_QK }),
  });
}
