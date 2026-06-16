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
        const res = await fetch("https://api.argentinadatos.com/v1/finanzas/indices/inflacion");
        if (!res.ok) throw new Error(`API error ${res.status}`);

        const data = await res.json();
        if (!data || data.length === 0) throw new Error("Insufficient IPC data");

        // Obtenemos el último registro
        const ultimoRegistro = data[data.length - 1];
        
        // LÓGICA DE PRECISIÓN (basada en el ejemplo de Milton)
        let valorIpc = ultimoRegistro.valor;
        if (valorIpc < 1 && valorIpc > 0) {
            valorIpc = parseFloat((valorIpc * 100).toFixed(2));
        } else {
            valorIpc = parseFloat(parseFloat(valorIpc).toFixed(2));
        }

        variation = valorIpc;
        // period: use the 1st of the month from the date string (YYYY-MM-DD)
        period = ultimoRegistro.fecha.substring(0, 7) + "-01";
        sourceName = "argentinadatos.com";
      } catch (err) {
        console.warn("Fallo fetch de argentinadatos.com, usando fallback argly.com.ar", err);
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
        p_value: variation,
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
