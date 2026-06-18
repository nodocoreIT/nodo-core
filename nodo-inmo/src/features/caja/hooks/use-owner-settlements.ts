import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/shared/lib/supabase";
import type { Database } from "@/shared/types/database";

export type OwnerSettlementRow =
  Database["nodo_inmo"]["Tables"]["owner_settlements"]["Row"];

export type SettlementWithOwner = OwnerSettlementRow & {
  owner: { name: string } | null;
  payment: {
    amount: number;
    paid_amount: number | null;
    expenses_amount: number | null;
    contract: {
      property: {
        id: string;
        address: string;
      } | null;
    } | null;
  } | null;
};

export const OWNER_SETTLEMENTS_QUERY_KEY = ["nodo_inmo", "owner_settlements"] as const;

/** List the org's owner settlements (admin-only via RLS), embedding the owner name. */
export function useOwnerSettlements() {
  return useQuery<SettlementWithOwner[]>({
    queryKey: OWNER_SETTLEMENTS_QUERY_KEY,
    queryFn: async () => {
      const { data, error } = await supabase
        .schema("nodo_inmo")
        .from("owner_settlements")
        .select(
          "*, owner:contacts!owner_settlements_owner_id_fkey(name), payment:payments!inner(amount, paid_amount, expenses_amount, contract:contracts!inner(property:properties!inner(id, address)))",
        )
        .order("created_at", { ascending: false });

      if (error) throw error;
      return (data ?? []) as unknown as SettlementWithOwner[];
    },
  });
}
