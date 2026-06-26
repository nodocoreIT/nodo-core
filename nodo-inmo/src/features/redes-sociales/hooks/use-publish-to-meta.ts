import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/shared/lib/supabase";
import { PROPERTIES_QUERY_KEY } from "@/features/properties/hooks/use-properties";

interface PublishToMetaInput {
  network: "instagram" | "facebook";
  property_id: string;
  caption: string;
  org_id: string;
}

interface PublishToMetaResult {
  success: boolean;
  post_id?: string;
  network?: string;
  error?: string;
}

export function usePublishToMeta() {
  const queryClient = useQueryClient();

  return useMutation<PublishToMetaResult, Error, PublishToMetaInput>({
    mutationFn: async (input) => {
      const { data, error } = await supabase.functions.invoke("publish-to-meta", {
        body: input,
      });
      if (error) throw error;
      return data as PublishToMetaResult;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PROPERTIES_QUERY_KEY });
    },
  });
}
