import { useMemo } from "react";
import { useIPCHistory } from "./use-ipc-history";

export interface IPCEntry {
  id: string;
  kind: string;
  period: string;
  value: number;
  source: string;
  created_at: string;
}

export const IPC_QUERY_KEY = ["ipc", "current"] as const;

export function useCurrentIPC() {
  const history = useIPCHistory(12);
  const data = useMemo((): IPCEntry | null => {
    const latest = history.data?.[0];
    if (!latest) return null;
    return {
      id: "live-ipc",
      kind: "IPC",
      period: latest.period,
      value: latest.value,
      source: "ipc-history",
      created_at: new Date().toISOString(),
    };
  }, [history.data]);

  return { ...history, data };
}
