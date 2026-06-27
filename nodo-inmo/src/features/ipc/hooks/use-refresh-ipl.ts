import { useMutation, useQueryClient } from "@tanstack/react-query";

import { IPL_QUERY_KEY } from "./use-current-ipl";

export function useRefreshIPL() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      return true;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: IPL_QUERY_KEY });
    },
  });
}
