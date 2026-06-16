import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/shared/lib/supabase";
import type { Database } from "@/shared/types/database";

type PropertyRow = Database["nodo_inmo"]["Tables"]["properties"]["Row"];

export type OwnerProperty = Pick<
  PropertyRow,
  | "id"
  | "address"
  | "property_type"
  | "operation"
  | "status"
  | "total_sqm"
  | "rooms"
  | "currency"
  | "sale_price"
  | "created_at"
>;

export const MY_PROPERTIES_QUERY_KEY = ["nodo_inmo", "my-properties"] as const;

/**
 * Fetch all properties owned by the current portal user.
 * RLS on properties scopes rows so that owner_id matches the user's contact.
 */
export function useMyProperties() {
  return useQuery<OwnerProperty[]>({
    queryKey: MY_PROPERTIES_QUERY_KEY,
    queryFn: async () => {
      const { data, error } = await supabase
        .schema("nodo_inmo")
        .from("properties")
        .select(
          "id, address, property_type, operation, status, total_sqm, rooms, currency, sale_price, created_at",
        )
        .order("created_at", { ascending: false });

      if (error) throw error;
      return (data ?? []) as OwnerProperty[];
    },
  });
}
