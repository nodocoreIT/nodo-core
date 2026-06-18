"use client";

import type { ProyectoDashboard } from "@/lib/obra/types";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { AlertTriangle, Eye, Receipt } from "lucide-react";
import Link from "next/link";

function formatMoney(value: number) {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(value);
}

function estadoShort(label: string): string {
  if (label.includes("Curso")) return "En curso";
  if (label.includes("Planificación")) return "Planificación";
  if (label.includes("Finalizada")) return "Finalizada";
  if (label.includes("Suspendido")) return "Suspendida";
  return label;
}

export function ObraCard({ obra }: { obra: ProyectoDashboard }) {
  return (
    <article className="flex min-w-0 flex-col rounded-xl border border-mist bg-white p-4 shadow-sm">
      <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <h3 className="font-display text-base font-bold leading-snug text-navy sm:text-lg">
            {obra.nombre}
          </h3>
          <p className="mt-0.5 line-clamp-2 text-xs text-slate2">
            {obra.propiedadVinculada}
          </p>
        </div>
        <span className="inline-flex w-fit max-w-full shrink-0 rounded-md bg-green-50 px-2 py-1 text-[10px] font-bold uppercase leading-tight text-green-800">
          <span className="hidden sm:inline">{obra.estadoLabel}</span>
          <span className="sm:hidden">{estadoShort(obra.estadoLabel)}</span>
        </span>
      </div>

      <div className="mt-4 space-y-1.5 text-sm">
        <div className="flex min-w-0 items-baseline justify-between gap-2">
          <span className="shrink-0 text-slate2">Presupuesto</span>
          <span className="truncate text-right font-semibold text-navy">
            {formatMoney(obra.presupuestoEstimado)}
          </span>
        </div>
        <div className="flex min-w-0 items-baseline justify-between gap-2">
          <span className="shrink-0 text-slate2">Gastado</span>
          <span
            className={cn(
              "truncate text-right font-bold",
              obra.alertaDesvio ? "text-red-600" : "text-green-700",
            )}
          >
            {formatMoney(obra.gastoReal)}
          </span>
        </div>
      </div>

      <div className="mt-4 grid min-w-0 grid-cols-2 gap-2">
        <div className="min-w-0 rounded-lg border-l-4 border-blue-500 bg-blue-50/60 p-2.5 text-center sm:p-3">
          <p className="text-[9px] font-bold uppercase tracking-wide text-slate2 sm:text-[10px]">
            Avance
          </p>
          <p className="text-lg font-extrabold text-blue-600 sm:text-xl">
            {obra.porcentajeAvance}%
          </p>
        </div>
        <div
          className={cn(
            "min-w-0 rounded-lg border-l-4 p-2.5 text-center sm:p-3",
            obra.alertaDesvio
              ? "border-red-500 bg-red-50/60"
              : "border-green-600 bg-green-50/60",
          )}
        >
          <p className="text-[9px] font-bold uppercase tracking-wide text-slate2 sm:text-[10px]">
            Caja
          </p>
          <p
            className={cn(
              "text-lg font-extrabold sm:text-xl",
              obra.alertaDesvio ? "text-red-600" : "text-green-700",
            )}
          >
            {obra.porcentajeGasto}%
          </p>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
        <Button
          variant="outline"
          size="sm"
          className="h-9 w-full min-w-0 justify-center gap-1.5 px-2"
          asChild
        >
          <Link href={`/obras/${obra.id}/carga`}>
            <Receipt className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">+ Ticket</span>
          </Link>
        </Button>
        <Button
          size="sm"
          className="h-9 w-full min-w-0 justify-center gap-1.5 px-2"
          asChild
        >
          <Link href={`/obras/${obra.id}`}>
            <Eye className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">Ver ficha</span>
          </Link>
        </Button>
      </div>

      {obra.alertaDesvio && (
        <p className="mt-3 flex items-start gap-1.5 text-xs font-medium text-red-600">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>Desvío presupuestario detectado</span>
        </p>
      )}
    </article>
  );
}
