import { useQuery } from "@tanstack/react-query";

export interface IPCHistoryEntry {
  period: string; // "YYYY-MM-DD"
  value: number;
}

export const IPC_HISTORY_QUERY_KEY = ["ipc", "history"] as const;

export function useIPCHistory() {
  return useQuery({
    queryKey: IPC_HISTORY_QUERY_KEY,
    queryFn: async (): Promise<IPCHistoryEntry[]> => {
      const res = await fetch("https://api.argentinadatos.com/v1/finanzas/indices/inflacion");
      if (!res.ok) throw new Error(`API error ${res.status}`);
      const data = await res.json();
      if (!data || data.length === 0) return [];

      return (data as Array<{ fecha: string; valor: number }>)
        .slice(-12)
        .map((item) => {
          let value = item.valor;
          if (value < 1 && value > 0) value = parseFloat((value * 100).toFixed(2));
          else value = parseFloat(parseFloat(String(value)).toFixed(2));
          return { period: item.fecha.substring(0, 7) + "-01", value };
        })
        .reverse();
    },
    staleTime: 1000 * 60 * 60,
  });
}
