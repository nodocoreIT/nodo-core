import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/shared/lib/supabase";
import { useAuth } from "@nodocore/shared-components";
import { RECLAMOS_QUERY_KEY } from "./use-reclamos";

export interface UpdateReclamoInput {
  id: string;
  status?: string;
  admin_notes?: string;
  resolved_at?: string | null;
}

/** Update a reclamo's status, admin notes, and/or resolved_at timestamp. */
export function useUpdateReclamo() {
  const queryClient = useQueryClient();
  const { orgId } = useAuth();

  return useMutation({
    mutationFn: async (input: UpdateReclamoInput) => {
      if (!orgId) throw new Error("No org_id — user not authenticated");

      const { id, ...fields } = input;

      const { data, error } = await supabase
        .schema("nodo_inmo")
        .from("reclamos")
        .update(fields)
        .eq("id", id)
        .eq("org_id", orgId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: RECLAMOS_QUERY_KEY });
    },
  });
}
