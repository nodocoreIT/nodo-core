import { useRef, useState, useEffect } from "react";
import { RefreshCw, ChevronDown } from "lucide-react";
import { useCurrentIPC } from "../hooks/use-current-ipc";
import { useRefreshIPC } from "../hooks/use-refresh-ipc";
import { useIPCHistory } from "../hooks/use-ipc-history";

function formatPeriod(period: string): string {
  const d = new Date(period + "T12:00:00");
  return d.toLocaleDateString("es-AR", { month: "short", year: "numeric" });
}

function HistoryDropdown({ onClose }: { onClose: () => void }) {
  const { data: history = [], isLoading } = useIPCHistory();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [onClose]);

  return (
    <div
      ref={ref}
      className="absolute right-0 top-full z-50 mt-2 w-52 rounded-lg border border-border bg-white shadow-lg"
    >
      <div className="border-b border-border px-3 py-2">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate2">
          Inflación mensual (IPC)
        </p>
      </div>
      <div className="max-h-56 overflow-y-auto py-1">
        {isLoading ? (
          <p className="px-3 py-2 text-xs text-slate2/60">Cargando…</p>
        ) : history.length === 0 ? (
          <p className="px-3 py-2 text-xs text-slate2/60">Sin datos</p>
        ) : (
          history.map((entry) => (
            <div
              key={entry.period}
              className="flex items-center justify-between px-3 py-1.5 text-xs hover:bg-slate-50"
            >
              <span className="capitalize text-slate2">{formatPeriod(entry.period)}</span>
              <span className="font-semibold text-navy">
                {entry.value > 0 ? "+" : ""}
                {entry.value.toFixed(1)}%
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export function IPCBadge() {
  const { data: ipc, isLoading } = useCurrentIPC();
  const refresh = useRefreshIPC();
  const [open, setOpen] = useState(false);

  if (isLoading) return null;

  return (
    <div className="relative">
      <div className="flex flex-shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border border-border bg-card px-2.5 py-1 text-[11px] font-semibold shadow-sm sm:gap-1.5 sm:px-3">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex items-center gap-1.5 focus:outline-none"
          aria-expanded={open}
          aria-label="Ver historial IPC"
        >
          <span className="font-bold uppercase tracking-wide text-slate2">IPC</span>
          {ipc ? (
            <>
              <span className="text-navy">
                {ipc.value > 0 ? "+" : ""}
                {ipc.value.toFixed(1)}%
              </span>
              <span className="hidden min-[420px]:inline text-slate2/70">{formatPeriod(ipc.period)}</span>
            </>
          ) : (
            <span className="text-slate2/70">—</span>
          )}
          <ChevronDown
            className={`h-3 w-3 text-slate2/50 transition-transform ${open ? "rotate-180" : ""}`}
          />
        </button>
        <button
          type="button"
          onClick={() =>
            refresh.mutate(undefined, {
              onError: () =>
                alert("No se pudo actualizar el IPC. Revisá tu conexión a internet o intentá de nuevo más tarde."),
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

      {open && <HistoryDropdown onClose={() => setOpen(false)} />}
    </div>
  );
}
