import { useQuery } from "@tanstack/react-query";

export interface IPLEntry {
  id: string;
  kind: string;
  period: string; // ISO date string "YYYY-MM-DD"
  value: number;
  source: string;
  created_at: string;
}

export const IPL_QUERY_KEY = ["ipl", "current"] as const;

export function useCurrentIPL() {
  return useQuery({
    queryKey: IPL_QUERY_KEY,
    queryFn: async (): Promise<IPLEntry | null> => {
      try {
        const res = await fetch("https://api.argly.com.ar/v1/ipl");
        if (!res.ok) throw new Error(`API error ${res.status}`);

        const json = await res.json();
        const data = json.data;

        if (!data || data.fecha === undefined || data.valor === undefined) {
          throw new Error("Invalid IPL data");
        }

        // Parse "DD/MM/YYYY" → "YYYY-MM-DD"
        const [day, month, year] = (data.fecha as string).split("/");
        const period = `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;

        return {
          id: "live-ipl",
          kind: "IPL",
          period,
          value: parseFloat(parseFloat(data.valor).toFixed(2)),
          source: "argly.com.ar",
          created_at: new Date().toISOString(),
        };
      } catch (err) {
        console.error("IPL fetch failed", err);
        return null;
      }
    },
    staleTime: 1000 * 60 * 60, // 1 hour
  });
}
