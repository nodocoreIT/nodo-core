import { useRef, useState, useEffect } from "react";
import { RefreshCw, ChevronDown } from "lucide-react";
import { useCurrentIPC } from "../hooks/use-current-ipc";
import { useCurrentICL } from "../hooks/use-current-icl";
import { useRefreshIPC } from "../hooks/use-refresh-ipc";
import { useRefreshICL } from "../hooks/use-refresh-icl";
import { useIPCHistory } from "../hooks/use-ipc-history";
import { useICLHistory } from "../hooks/use-icl-history";

function formatPeriod(period: string): string {
  const d = new Date(period + "T12:00:00");
  return d.toLocaleDateString("es-AR", { month: "short", year: "numeric" });
}

function formatDate(period: string): string {
  const d = new Date(period + "T12:00:00");
  return d.toLocaleDateString("es-AR", { day: "2-digit", month: "short", year: "numeric" });
}

function HistoryDropdown({ onClose }: { onClose: () => void }) {
  const { data: ipcHistory = [], isLoading: ipcLoading } = useIPCHistory();
  const { data: iclHistory = [], isLoading: iclLoading } = useICLHistory();
  const refreshIPC = useRefreshIPC();
  const refreshICL = useRefreshICL();
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
      className="absolute right-0 top-full z-50 mt-2 w-64 rounded-lg border border-border bg-white shadow-lg"
    >
      {/* IPC */}
      <div className="flex items-center justify-between border-b border-border px-3 py-2">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate2">
          Inflación mensual (IPC)
        </p>
        <button
          type="button"
          onClick={() => refreshIPC.mutate(undefined, { onError: () => alert("No se pudo actualizar el IPC.") })}
          disabled={refreshIPC.isPending}
          className="text-slate2 hover:text-brand disabled:opacity-40 transition-colors"
          aria-label="Actualizar IPC"
        >
          <RefreshCw className={`h-3 w-3 ${refreshIPC.isPending ? "animate-spin" : ""}`} />
        </button>
      </div>
      <div className="max-h-40 overflow-y-auto py-1">
        {ipcLoading ? (
          <p className="px-3 py-2 text-xs text-slate2/60">Cargando…</p>
        ) : ipcHistory.length === 0 ? (
          <p className="px-3 py-2 text-xs text-slate2/60">Sin datos</p>
        ) : (
          ipcHistory.map((entry) => (
            <div key={entry.period} className="flex items-center justify-between px-3 py-1.5 text-xs hover:bg-slate-50">
              <span className="capitalize text-slate2">{formatPeriod(entry.period)}</span>
              <span className="font-semibold text-navy">
                {entry.value > 0 ? "+" : ""}{entry.value.toFixed(1)}%
              </span>
            </div>
          ))
        )}
      </div>

      {/* ICL */}
      <div className="flex items-center justify-between border-b border-t border-border px-3 py-2">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate2">
          Índice Casa Propia (ICL)
        </p>
        <button
          type="button"
          onClick={() => refreshICL.mutate(undefined, { onError: () => alert("No se pudo actualizar el ICL.") })}
          disabled={refreshICL.isPending}
          className="text-slate2 hover:text-brand disabled:opacity-40 transition-colors"
          aria-label="Actualizar ICL"
        >
          <RefreshCw className={`h-3 w-3 ${refreshICL.isPending ? "animate-spin" : ""}`} />
        </button>
      </div>
      <div className="max-h-40 overflow-y-auto py-1">
        {iclLoading ? (
          <p className="px-3 py-2 text-xs text-slate2/60">Cargando…</p>
        ) : iclHistory.length === 0 ? (
          <p className="px-3 py-2 text-xs text-slate2/60">Sin datos históricos</p>
        ) : (
          iclHistory.map((entry) => (
            <div key={entry.period} className="flex items-center justify-between px-3 py-1.5 text-xs hover:bg-slate-50">
              <span className="capitalize text-slate2">{formatDate(entry.period)}</span>
              <span className="font-semibold text-navy">{entry.value.toFixed(2)}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export function IndicesBadge() {
  const { data: ipc, isLoading: ipcLoading } = useCurrentIPC();
  const { data: icl, isLoading: iclLoading } = useCurrentICL();
  const [open, setOpen] = useState(false);

  if (ipcLoading && iclLoading) return null;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex flex-shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border border-border bg-card px-2.5 py-1 text-[11px] font-semibold shadow-sm hover:bg-accent transition-colors focus:outline-none sm:px-3"
      >
        <span className="font-bold uppercase tracking-wide text-slate2">IPC</span>
        {ipc ? (
          <span className="text-navy">{ipc.value > 0 ? "+" : ""}{ipc.value.toFixed(1)}%</span>
        ) : (
          <span className="text-slate2/70">—</span>
        )}
        <span className="text-slate2/30">·</span>
        <span className="font-bold uppercase tracking-wide text-slate2">ICL</span>
        {icl ? (
          <span className="text-navy">{icl.value.toFixed(2)}</span>
        ) : (
          <span className="text-slate2/70">—</span>
        )}
        <ChevronDown className={`h-3 w-3 text-slate2/50 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && <HistoryDropdown onClose={() => setOpen(false)} />}
    </div>
  );
}
