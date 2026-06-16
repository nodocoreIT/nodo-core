import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/shared/lib/supabase";

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
      const { data, error } = await supabase
        .schema("shared")
        .from("indices")
        .select("*")
        .eq("kind", "IPC")
        .order("period", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data as IPCEntry | null;
    },
    staleTime: 1000 * 60 * 60, // 1 hour
  });
}
