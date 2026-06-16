import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/shared/lib/supabase";
import { IPC_QUERY_KEY } from "./use-current-ipc";

interface DatosGobResponse {
  data: [string, number][];   // [date_str, index_value][]
  meta: unknown;
}

/**
 * Fetches IPC from Argentina's open data API (datos.gob.ar) and persists
 * the monthly % variation into shared.indices via the upsert_index_value RPC.
 *
 * Series 145.3_INGNACNAL_DICI_M_15 = IPC Nacional Nivel General (monthly index)
 */
export function useRefreshIPC() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      let variation: number;
      let period: string;
      let sourceName: string;

      try {
        const res = await fetch(
          "https://apis.datos.gob.ar/series/api/series/?ids=145.3_INGNACNAL_DICI_M_15&limit=2&sort=desc&format=json",
        );
        if (!res.ok) throw new Error(`API error ${res.status}`);

        const json: DatosGobResponse = await res.json();
        const rows = json.data;
        if (!rows || rows.length < 2) throw new Error("Insufficient IPC data");

        // rows[0] = most recent month, rows[1] = previous month
        const [dateStr, current] = rows[0];
        const [, previous] = rows[1];

        variation = ((current - previous) / previous) * 100;
        // period: use the 1st of the month from the date string (YYYY-MM-DD)
        period = dateStr.substring(0, 7) + "-01";
        sourceName = "datos.gob.ar";
      } catch (err) {
        console.warn("Fallo fetch de datos.gob.ar, usando fallback argly.com.ar", err);
        // Fallback a Argly
        const arglyRes = await fetch("https://api.argly.com.ar/v1/ipc");
        if (!arglyRes.ok) throw new Error(`Argly API error ${arglyRes.status}`);
        
        const arglyJson = await arglyRes.json();
        const data = arglyJson.data;
        
        if (!data || data.indice_ipc === undefined) throw new Error("Invalid Argly IPC data");
        
        variation = data.indice_ipc;
        period = `${data.anio}-${String(data.mes).padStart(2, '0')}-01`;
        sourceName = "argly.com.ar";
      }

      const { data: result, error } = await supabase.schema("shared").rpc("upsert_index_value", {
        p_kind: "IPC",
        p_period: period,
        p_value: parseFloat(variation.toFixed(2)),
        p_source: sourceName,
      });
      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: IPC_QUERY_KEY });
    },
  });
}
