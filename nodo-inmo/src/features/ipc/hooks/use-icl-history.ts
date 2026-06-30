import { useQuery } from "@tanstack/react-query";

export interface ICLHistoryEntry {
  period: string; // "YYYY-MM-DD"
  value: number;
}

export const ICL_HISTORY_QUERY_KEY = ["icl", "history"] as const;

export function useICLHistory() {
  return useQuery({
    queryKey: ICL_HISTORY_QUERY_KEY,
    queryFn: async (): Promise<ICLHistoryEntry[]> => {
      const res = await fetch("https://api.argentinadatos.com/v1/finanzas/indices/casapropia");
      if (!res.ok) throw new Error(`API error ${res.status}`);
      const data = await res.json();
      if (!data || data.length === 0) return [];

      return (data as Array<{ fecha: string; valor: number }>)
        .slice(-12)
        .map((item) => ({
          period: item.fecha.substring(0, 10),
          value: parseFloat(parseFloat(String(item.valor)).toFixed(2)),
        }))
        .reverse();
    },
    staleTime: 1000 * 60 * 60,
  });
}
