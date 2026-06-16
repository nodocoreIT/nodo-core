import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/shared/lib/supabase";
import type { Database } from "@/shared/types/database";

export type ContractRow = Database["nodo_inmo"]["Tables"]["contracts"]["Row"];

export type MyContractWithRelations = ContractRow & {
  property: {
    address: string;
    total_sqm: number | null;
    rooms: number | null;
    owner: {
      name: string;
      phone: string | null;
    } | null;
  } | null;
};

export const MY_CONTRACT_QUERY_KEY = ["nodo_inmo", "my-contract"] as const;

/**
 * Fetch the tenant's most recent (active) contract with embedded property
 * and property owner. RLS enforces that the tenant can only see their own
 * contracts (tenant_id matches the contact whose portal_user_id = auth.uid()).
 */
export function useMyContract() {
  return useQuery<MyContractWithRelations | null>({
    queryKey: MY_CONTRACT_QUERY_KEY,
    queryFn: async () => {
      const { data, error } = await supabase
        .schema("nodo_inmo")
        .from("contracts")
        .select(
          "*, property:properties!contracts_property_id_fkey(" +
            "address, total_sqm, rooms, " +
            "owner:contacts!properties_owner_contact_id_fkey(name, phone)" +
          ")",
        )
        .order("start_date", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      return data as MyContractWithRelations | null;
    },
  });
}
