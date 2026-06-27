import { useMutation, useQueryClient } from "@tanstack/react-query";

import { ICL_QUERY_KEY } from "./use-current-icl";

export function useRefreshICL() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      return true;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ICL_QUERY_KEY });
    },
  });
}
