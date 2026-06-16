import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/shared/lib/supabase";
import type { Database } from "@/shared/types/database";

export type ReclamoRow = Database["nodo_inmo"]["Tables"]["reclamos"]["Row"];

export type ReclamoWithRelations = ReclamoRow & {
  property: {
    address: string;
  } | null;
};

export const MY_RECLAMOS_QUERY_KEY = ["nodo_inmo", "my-reclamos"] as const;

/**
 * Fetch all reclamos submitted by the authenticated tenant.
 * RLS scopes rows to the tenant's contact_id. Embeds property address.
 */
export function useMyReclamos() {
  return useQuery<ReclamoWithRelations[]>({
    queryKey: MY_RECLAMOS_QUERY_KEY,
    queryFn: async () => {
      const { data, error } = await supabase
        .schema("nodo_inmo")
        .from("reclamos")
        .select(
          "*, property:properties!reclamos_property_id_fkey(address)",
        )
        .order("created_at", { ascending: false });

      if (error) throw error;
      return (data ?? []) as unknown as ReclamoWithRelations[];
    },
  });
}
