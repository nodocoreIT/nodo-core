import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/shared/lib/supabase";
import { keepClosedMonths, mergeIndexHistory } from "../lib/merge-index-history";
import { buildIpcHistoryFromLevels } from "../lib/ipc-from-levels";

export interface IPCHistoryEntry {
  period: string; // "YYYY-MM-DD"
  value: number;
  /** INDEC IPC index level (base Dec 2016 = 100). Used for official accumulated %. */
  level?: number;
}

export const IPC_HISTORY_QUERY_KEY = ["ipc", "history"] as const;

const IPC_LEVEL_SERIES_ID = "148.3_INIVELNAL_DICI_M_26";

function normalizeIpcValue(raw: number): number {
  if (raw < 1 && raw > 0) return parseFloat((raw * 100).toFixed(2));
  return parseFloat(parseFloat(String(raw)).toFixed(2));
}

async function fetchOfficialIpcRates(): Promise<IPCHistoryEntry[]> {
  const res = await fetch("https://api.argentinadatos.com/v1/finanzas/indices/inflacion");
  if (!res.ok) throw new Error(`API error ${res.status}`);
  const data = await res.json();
  if (!data || data.length === 0) return [];

  return (data as Array<{ fecha: string; valor: number }>).map((item) => ({
    period: item.fecha.substring(0, 7) + "-01",
    value: normalizeIpcValue(item.valor),
  }));
}

async function fetchOfficialIpcLevels(): Promise<Array<{ period: string; level: number }>> {
  const url = `https://apis.datos.gob.ar/series/api/series/?ids=${IPC_LEVEL_SERIES_ID}&limit=5000&format=json`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`IPC levels API error ${res.status}`);
  const json = await res.json();
  const rows: unknown[] = Array.isArray(json?.data) ? json.data : [];
  const out: Array<{ period: string; level: number }> = [];
  for (const row of rows) {
    const pair = Array.isArray(row)
      ? row
      : Array.isArray((row as { value?: unknown }).value)
        ? (row as { value: unknown[] }).value
        : null;
    if (!pair || pair.length < 2) continue;
    const period = String(pair[0]).slice(0, 7) + "-01";
    const level = Number(pair[1]);
    if (!period.startsWith("20") || !Number.isFinite(level) || level <= 0) continue;
    out.push({ period, level });
  }
  return out;
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
      let manual: IPCHistoryEntry[] = [];
      try {
        manual = await fetchManualIpc();
      } catch (err) {
        console.warn("No se pudieron leer IPC manuales de shared.indices", err);
      }

      try {
        const levels = await fetchOfficialIpcLevels();
        if (levels.length > 0) {
          return buildIpcHistoryFromLevels(levels, manual).slice(0, months);
        }
      } catch (err) {
        console.warn("No se pudo leer el IPC nivel INDEC; se usa la serie mensual", err);
      }

      const official = await fetchOfficialIpcRates();
      return keepClosedMonths(mergeIndexHistory(official, manual)).slice(0, months);
    },
    staleTime: 1000 * 60 * 5,
  });
}
