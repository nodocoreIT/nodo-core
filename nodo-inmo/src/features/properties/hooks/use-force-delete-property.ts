import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/shared/lib/supabase";
import { PROPERTIES_QUERY_KEY } from "./use-properties";

export function useForceDeleteProperty() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error: contractsError } = await supabase
        .schema("nodo_inmo")
        .from("contracts")
        .update({ property_id: null })
        .eq("property_id", id);

      if (contractsError) throw contractsError;

      const { error } = await supabase
        .schema("nodo_inmo")
        .from("properties")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PROPERTIES_QUERY_KEY });
    },
  });
}
