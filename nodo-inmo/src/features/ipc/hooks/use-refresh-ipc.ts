import { useMutation, useQueryClient } from "@tanstack/react-query";

import { IPC_QUERY_KEY } from "./use-current-ipc";



export function useRefreshIPC() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      // Ahora el IPC se lee directamente de la API en useCurrentIPC.
      // Solo necesitamos invalidar la caché para forzar un refetch.
      return true;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: IPC_QUERY_KEY });
    },
  });
}
