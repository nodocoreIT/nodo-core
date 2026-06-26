import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/shared/lib/supabase";
import { useAuth } from "@nodocore/shared-components";
import type { Database } from "@/shared/types/database";
import { CONTACTS_QUERY_KEY } from "./use-contacts";

type ContactInsert = Database["nodo_inmo"]["Tables"]["contacts"]["Insert"];

export type CreateContactInput = Omit<ContactInsert, "org_id">;

export function useCreateContact() {
  const queryClient = useQueryClient();
  const { orgId } = useAuth();

  return useMutation({
    mutationFn: async (input: CreateContactInput) => {
      if (!orgId) throw new Error("No org_id — user not fully provisioned");

      const { data, error } = await supabase
        .schema("nodo_inmo")
        .from("contacts")
        .insert({ ...input, org_id: orgId })
        .select("id,name,dni,phone,email,address,commission_rate,can_view_rentals,can_view_construction,can_view_sales,roles,created_at,updated_at")
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CONTACTS_QUERY_KEY });
    },
  });
}
