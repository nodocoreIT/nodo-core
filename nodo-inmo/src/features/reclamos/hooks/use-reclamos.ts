import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/shared/lib/supabase";
import { useAuth } from "@nodocore/shared-components";
import type { Database } from "@/shared/types/database";

export type ReclamoRow = Database["nodo_inmo"]["Tables"]["reclamos"]["Row"];

export type ReclamoWithRelations = ReclamoRow & {
  contact: { name: string; phone: string | null } | null;
  property: { address: string } | null;
};

export const RECLAMOS_QUERY_KEY = ["nodo_inmo", "reclamos"] as const;

/** Fetch all reclamos for the current org with contact name and property address. */
export function useReclamos() {
  const { orgId } = useAuth();

  return useQuery<ReclamoWithRelations[]>({
    queryKey: [...RECLAMOS_QUERY_KEY, orgId],
    queryFn: async () => {
      if (!orgId) return [];

      const { data, error } = await supabase
        .schema("nodo_inmo")
        .from("reclamos")
        .select(
          "*, contact:contacts!reclamos_contact_id_fkey(name, phone), property:properties!reclamos_property_id_fkey(address)"
        )
        .eq("org_id", orgId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return (data ?? []) as ReclamoWithRelations[];
    },
    enabled: !!orgId,
  });
}
