import { RefreshCw } from "lucide-react";
import { useCurrentIPC } from "../hooks/use-current-ipc";
import { useRefreshIPC } from "../hooks/use-refresh-ipc";

function formatPeriod(period: string): string {
  const d = new Date(period + "T12:00:00");
  return d.toLocaleDateString("es-AR", { month: "short", year: "numeric" });
}

export function IPCBadge() {
  const { data: ipc, isLoading } = useCurrentIPC();
  const refresh = useRefreshIPC();

  if (isLoading) return null;

  return (
    <div className="flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1 text-[11px] font-semibold shadow-sm">
      <span className="font-bold uppercase tracking-wide text-slate2">IPC</span>
      {ipc ? (
        <>
          <span className="text-navy">
            {ipc.value > 0 ? "+" : ""}
            {ipc.value.toFixed(1)}%
          </span>
          <span className="text-slate2/70">{formatPeriod(ipc.period)}</span>
        </>
      ) : (
        <span className="text-slate2/70">—</span>
      )}
      <button
        type="button"
        onClick={() => 
          refresh.mutate(undefined, {
            onError: () => alert("No se pudo actualizar el IPC. Revisá tu conexión a internet o intentá de nuevo más tarde.")
          })
        }
        disabled={refresh.isPending}
        title="Actualizar IPC"
        className="ml-0.5 text-slate2 hover:text-brand disabled:opacity-40 transition-colors"
        aria-label="Actualizar IPC"
      >
        <RefreshCw className={`h-3 w-3 ${refresh.isPending ? "animate-spin" : ""}`} />
      </button>
    </div>
  );
}
