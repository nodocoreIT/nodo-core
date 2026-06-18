import Link from "next/link";
import type { PresupuestoResumen } from "@/lib/obra/types";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

function formatMoney(value: number) {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(value);
}

const ESTADO_STYLE: Record<PresupuestoResumen["estado"], string> = {
  BORRADOR: "bg-slate-100 text-slate-700",
  ENVIADO: "bg-sky-100 text-sky-800",
  APROBADO: "bg-green-100 text-green-800",
  RECHAZADO: "bg-red-100 text-red-800",
  CONVERTIDO: "bg-brand/10 text-brand",
};

export function PresupuestoCard({ item }: { item: PresupuestoResumen }) {
  return (
    <article className="rounded-xl border border-mist bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="mb-1 flex flex-wrap items-center gap-2">
            <h3 className="font-display font-bold text-navy">{item.titulo}</h3>
            <span
              className={cn(
                "rounded-full px-2 py-0.5 text-[10px] font-bold uppercase",
                ESTADO_STYLE[item.estado],
              )}
            >
              {item.estadoLabel}
            </span>
          </div>
          <p className="text-sm text-slate2">{item.direccionObra}</p>
          <p className="text-xs text-slate2">{item.clienteNombre}</p>
        </div>
        <div className="text-right">
          <p className="text-lg font-bold text-brand">
            {formatMoney(item.total)}
          </p>
          <p className="text-xs text-slate2">
            {item.rubrosCount} rubro{item.rubrosCount === 1 ? "" : "s"}
          </p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <Button size="sm" variant="outline" asChild>
          <Link href={`/obras/presupuestos/${item.id}`}>Ver detalle</Link>
        </Button>
        {item.proyectoId && (
          <Button size="sm" asChild>
            <Link href={`/obras/${item.proyectoId}`}>Ir a la obra</Link>
          </Button>
        )}
      </div>
    </article>
  );
}
