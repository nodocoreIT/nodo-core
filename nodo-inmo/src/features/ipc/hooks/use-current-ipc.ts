import { useQuery } from "@tanstack/react-query";

export interface IPCEntry {
  id: string;
  kind: string;
  period: string;   // ISO date string "YYYY-MM-DD"
  value: number;
  source: string;
  created_at: string;
}

export const IPC_QUERY_KEY = ["ipc", "current"] as const;

export function useCurrentIPC() {
  return useQuery({
    queryKey: IPC_QUERY_KEY,
    queryFn: async (): Promise<IPCEntry | null> => {
      try {
        const res = await fetch("https://api.argentinadatos.com/v1/finanzas/indices/inflacion");
        if (!res.ok) throw new Error(`API error ${res.status}`);

        const data = await res.json();
        if (!data || data.length === 0) throw new Error("Insufficient IPC data");

        const ultimoRegistro = data[data.length - 1];
        
        let valorIpc = ultimoRegistro.valor;
        if (valorIpc < 1 && valorIpc > 0) {
            valorIpc = parseFloat((valorIpc * 100).toFixed(2));
        } else {
            valorIpc = parseFloat(parseFloat(valorIpc).toFixed(2));
        }

        const period = ultimoRegistro.fecha.substring(0, 7) + "-01";
        
        return {
          id: "live-ipc",
          kind: "IPC",
          period,
          value: valorIpc,
          source: "argentinadatos.com",
          created_at: new Date().toISOString(),
        };
      } catch (err) {
        console.warn("Fallo fetch de argentinadatos.com, usando fallback argly.com.ar", err);
        // Fallback a Argly
        try {
          const arglyRes = await fetch("https://api.argly.com.ar/v1/ipc");
          if (!arglyRes.ok) throw new Error(`Argly API error ${arglyRes.status}`);
          
          const arglyJson = await arglyRes.json();
          const data = arglyJson.data;
          
          if (!data || data.indice_ipc === undefined) throw new Error("Invalid Argly IPC data");
          
          return {
            id: "live-ipc",
            kind: "IPC",
            period: `${data.anio}-${String(data.mes).padStart(2, '0')}-01`,
            value: data.indice_ipc,
            source: "argly.com.ar",
            created_at: new Date().toISOString(),
          };
        } catch (fallbackErr) {
          console.error("Ambas APIs de IPC fallaron", fallbackErr);
          return null;
        }
      }
    },
    staleTime: 1000 * 60 * 60, // 1 hour
  });
}
