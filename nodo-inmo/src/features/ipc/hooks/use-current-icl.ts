import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/shared/lib/supabase";

export interface ICLEntry {
  id: string;
  kind: string;
  period: string; // ISO date string "YYYY-MM-DD"
  value: number;
  source: string;
  created_at: string;
}

export const ICL_QUERY_KEY = ["icl", "current"] as const;

export function useCurrentICL() {
  return useQuery({
    queryKey: ICL_QUERY_KEY,
    queryFn: async (): Promise<ICLEntry | null> => {
      try {
        // Proxied through our own Edge Function — a direct browser fetch to
        // api.argly.com.ar gets blocked by CORS (that API doesn't send
        // Access-Control-Allow-Origin), see get-current-icl/index.ts.
        const { data: json, error } = await supabase.functions.invoke("get-current-icl");
        if (error) throw new Error(error.message);
        const data = json.data;

        if (!data || data.fecha === undefined || data.valor === undefined) {
          throw new Error("Invalid ICL data");
        }

        // Parse "DD/MM/YYYY" → "YYYY-MM-DD"
        const [day, month, year] = (data.fecha as string).split("/");
        const period = `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;

        return {
          id: "live-icl",
          kind: "ICL",
          period,
          value: parseFloat(parseFloat(data.valor).toFixed(2)),
          source: "argly.com.ar",
          created_at: new Date().toISOString(),
        };
      } catch (err) {
        console.error("ICL fetch failed", err);
        return null;
      }
    },
    staleTime: 1000 * 60 * 60, // 1 hour
  });
}
