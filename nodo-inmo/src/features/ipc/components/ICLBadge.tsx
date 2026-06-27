import { RefreshCw } from "lucide-react";
import { useCurrentICL } from "../hooks/use-current-icl";
import { useRefreshICL } from "../hooks/use-refresh-icl";

function formatDate(period: string): string {
  const d = new Date(period + "T12:00:00");
  return d.toLocaleDateString("es-AR", { day: "2-digit", month: "short", year: "numeric" });
}

export function ICLBadge() {
  const { data: icl, isLoading } = useCurrentICL();
  const refresh = useRefreshICL();

  if (isLoading) return null;

  return (
    <div className="flex flex-shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border border-border bg-card px-2.5 py-1 text-[11px] font-semibold shadow-sm sm:gap-1.5 sm:px-3">
      <span className="font-bold uppercase tracking-wide text-slate2">ICL</span>
      {icl ? (
        <>
          <span className="text-navy">{icl.value.toFixed(2)}</span>
          <span className="hidden min-[420px]:inline text-slate2/70">{formatDate(icl.period)}</span>
        </>
      ) : (
        <span className="text-slate2/70">—</span>
      )}
      <button
        type="button"
        onClick={() =>
          refresh.mutate(undefined, {
            onError: () => alert("No se pudo actualizar el ICL. Revisá tu conexión a internet o intentá de nuevo más tarde.")
          })
        }
        disabled={refresh.isPending}
        title="Actualizar ICL"
        className="ml-0.5 text-slate2 hover:text-brand disabled:opacity-40 transition-colors"
        aria-label="Actualizar ICL"
      >
        <RefreshCw className={`h-3 w-3 ${refresh.isPending ? "animate-spin" : ""}`} />
      </button>
    </div>
  );
}
