import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/shared/lib/supabase";

export interface ICLHistoryEntry {
  period: string; // "YYYY-MM-DD"
  value: number;
}

export const ICL_HISTORY_QUERY_KEY = ["icl", "history"] as const;

function toIsoDate(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Parses "DD/MM/YYYY" (as returned by the ICL API) into "YYYY-MM-DD". */
function parseArglyDate(fecha: string): string {
  const [day, month, year] = fecha.split("/");
  return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
}

export function useICLHistory() {
  return useQuery({
    queryKey: ICL_HISTORY_QUERY_KEY,
    queryFn: async (): Promise<ICLHistoryEntry[]> => {
      const today = new Date();
      const from = new Date(today);
      // ~25 months back: covers 12 months of month-over-month history plus,
      // for the oldest of those months, the same month a year earlier —
      // needed for the interannual % shown alongside the monthly one.
      from.setDate(from.getDate() - 760);

      // Proxied through our own Edge Function — a direct browser fetch to
      // api.argly.com.ar gets blocked by CORS, see get-current-icl/index.ts.
      // With a desde/hasta range it returns the daily historical series
      // instead of just today's value.
      const { data: json, error } = await supabase.functions.invoke(
        `get-current-icl?desde=${toIsoDate(from)}&hasta=${toIsoDate(today)}`,
      );
      if (error) throw new Error(error.message);

      const rows = json?.data;
      if (!Array.isArray(rows) || rows.length === 0) return [];

      const byDate = new Map<string, number>();
      for (const row of rows as Array<{ fecha: string; valor: number | string }>) {
        if (row?.fecha === undefined || row?.valor === undefined) continue;
        const value = parseFloat(parseFloat(String(row.valor)).toFixed(2));
        if (Number.isNaN(value)) continue;
        byDate.set(parseArglyDate(row.fecha), value);
      }

      return Array.from(byDate.entries())
        .map(([period, value]) => ({ period, value }))
        .sort((a, b) => a.period.localeCompare(b.period));
    },
    staleTime: 1000 * 60 * 60,
  });
}
