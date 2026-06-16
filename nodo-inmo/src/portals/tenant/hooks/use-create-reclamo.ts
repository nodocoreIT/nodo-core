import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/shared/lib/supabase";
import type { Database } from "@/shared/types/database";
import { MY_RECLAMOS_QUERY_KEY } from "./use-my-reclamos";

type ReclamoInsert = Database["nodo_inmo"]["Tables"]["reclamos"]["Insert"];

/**
 * Mutation to insert a new reclamo on behalf of the authenticated tenant.
 * On success invalidates the my-reclamos query so the list refreshes.
 */
export function useCreateReclamo() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: ReclamoInsert) => {
      const { data, error } = await supabase
        .schema("nodo_inmo")
        .from("reclamos")
        .insert(payload)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: MY_RECLAMOS_QUERY_KEY });
    },
  });
}
