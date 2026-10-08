import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/shared/lib/supabase";
import { mergeIndexHistory } from "../lib/merge-index-history";

export interface IPCHistoryEntry {
  period: string; // "YYYY-MM-DD"
  value: number;
}

export const IPC_HISTORY_QUERY_KEY = ["ipc", "history"] as const;

function normalizeIpcValue(raw: number): number {
  if (raw < 1 && raw > 0) return parseFloat((raw * 100).toFixed(2));
  return parseFloat(parseFloat(String(raw)).toFixed(2));
}

async function fetchOfficialIpc(): Promise<IPCHistoryEntry[]> {
  const res = await fetch("https://api.argentinadatos.com/v1/finanzas/indices/inflacion");
  if (!res.ok) throw new Error(`API error ${res.status}`);
  const data = await res.json();
  if (!data || data.length === 0) return [];

  return (data as Array<{ fecha: string; valor: number }>).map((item) => ({
    period: item.fecha.substring(0, 7) + "-01",
    value: normalizeIpcValue(item.valor),
  }));
}

async function fetchManualIpc(): Promise<IPCHistoryEntry[]> {
  const { data, error } = await supabase
    .schema("shared")
    .from("indices")
    .select("period, value")
    .eq("kind", "IPC");
  if (error) throw error;
  return (data ?? []).map((row) => ({
    period: String(row.period).substring(0, 10),
    value: normalizeIpcValue(Number(row.value)),
  }));
}

/** `months` = how many of the latest months to return (newest first). */
export function useIPCHistory(months = 12) {
  return useQuery({
    queryKey: [...IPC_HISTORY_QUERY_KEY, months],
    queryFn: async (): Promise<IPCHistoryEntry[]> => {
      const official = await fetchOfficialIpc();
      let manual: IPCHistoryEntry[] = [];
      try {
        manual = await fetchManualIpc();
      } catch (err) {
        console.warn("No se pudieron leer IPC manuales de shared.indices", err);
      }
      return mergeIndexHistory(official, manual).slice(0, months);
    },
    staleTime: 1000 * 60 * 60,
  });
}
