import { useMutation, useQueryClient } from "@tanstack/react-query";

export function useRefreshIPC() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => true,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ipc"] });
    },
  });
}
