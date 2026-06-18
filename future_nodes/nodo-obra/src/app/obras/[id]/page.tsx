"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Receipt, Trash2 } from "lucide-react";
import { obraApi } from "@/lib/obra/client-api";
import type {
  LocalFotoAvance,
  LocalGasto,
  LocalProyecto,
  LocalRubro,
  LocalTarea,
  ProyectoDashboard,
  RubroProgresoView,
} from "@/lib/obra/types";
import { ObraAvancePanel } from "@/components/obra/obra-avance-panel";
import { ObraFotosPanel } from "@/components/obra/obra-fotos-panel";
import { ObraPendientesPanel } from "@/components/obra/obra-pendientes-panel";
import { Button } from "@/components/ui/button";
import { Building2 } from "lucide-react";
import { cn } from "@/lib/utils";

function formatMoney(value: number) {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(value);
}

export default function FichaObraPage() {
  const params = useParams();
  const id = String(params.id);
  const [proyecto, setProyecto] = useState<LocalProyecto | null>(null);
  const [resumen, setResumen] = useState<ProyectoDashboard | null>(null);
  const [tareas, setTareas] = useState<LocalTarea[]>([]);
  const [gastos, setGastos] = useState<LocalGasto[]>([]);
  const [rubros, setRubros] = useState<LocalRubro[]>([]);
  const [rubrosProgreso, setRubrosProgreso] = useState<RubroProgresoView[]>([]);
  const [fotos, setFotos] = useState<LocalFotoAvance[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    return Promise.all([
      obraApi.getProyecto(id),
      obraApi.getGastos(id),
      obraApi.getFotosAvance(id),
    ]).then(([proyectoData, gastosData, fotosData]) => {
      setProyecto(proyectoData.proyecto);
      setResumen(proyectoData.resumen);
      setTareas(proyectoData.tareas);
      setRubrosProgreso(proyectoData.rubrosProgreso);
      setGastos(gastosData.gastos);
      setRubros(gastosData.rubros);
      setFotos(fotosData.fotos);
    });
  }, [id]);

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, [load]);

  const rubroNombre = (rubroId: string | null) =>
    rubros.find((r) => r.id === rubroId)?.nombre ?? "General";

  const handleDeleteGasto = async (gastoId: string) => {
    if (!confirm("¿Borrar este ticket?")) return;
    await obraApi.deleteGasto(gastoId);
    const refreshed = await obraApi.getGastos(id);
    setGastos(refreshed.gastos);
    const proyectoData = await obraApi.getProyecto(id);
    setResumen(proyectoData.resumen);
  };

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand border-t-transparent" />
      </div>
    );
  }

  if (!proyecto || !resumen) {
    return <p className="text-sm text-red-600">Obra no encontrada.</p>;
  }

  const saldo = resumen.presupuestoEstimado - resumen.gastoReal;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate2">
            Centro de control de obra
          </p>
          <h2 className="font-display text-2xl font-bold text-navy">
            {proyecto.nombre}
          </h2>
          <p className="text-sm text-slate2">{proyecto.direccionObra}</p>
          {proyecto.inmoPropertyLabel && (
            <p className="mt-1 flex items-center gap-1 text-xs text-brand">
              <Building2 className="h-3.5 w-3.5" />
              nodo-inmo: {proyecto.inmoPropertyLabel}
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" asChild>
            <Link href={`/obras/${id}/carga`}>
              <Receipt className="mr-1.5 h-4 w-4" />
              Carga rápida
            </Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link href="/obras">Volver al tablero</Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <div className="rounded-md border border-mist bg-white p-4">
          <p className="text-xs uppercase text-slate2">Presupuesto</p>
          <p className="text-lg font-bold text-navy">
            {formatMoney(resumen.presupuestoEstimado)}
          </p>
        </div>
        <div className="rounded-md border border-mist bg-white p-4">
          <p className="text-xs uppercase text-slate2">Gastado</p>
          <p className="text-lg font-bold text-red-700">
            {formatMoney(resumen.gastoReal)}
          </p>
        </div>
        <div
          className={cn(
            "rounded-md border p-4",
            saldo < 0
              ? "border-red-200 bg-red-50"
              : "border-green-200 bg-green-50",
          )}
        >
          <p className="text-xs uppercase text-slate2">Saldo</p>
          <p className="text-lg font-bold text-navy">{formatMoney(saldo)}</p>
        </div>
        <div className="rounded-md border border-mist bg-white p-4">
          <p className="text-xs uppercase text-slate2">Avance</p>
          <p className="text-lg font-bold text-blue-600">
            {resumen.porcentajeAvance}%
          </p>
        </div>
        <div className="rounded-md border border-mist bg-white p-4">
          <p className="text-xs uppercase text-slate2">Estado</p>
          <p className="text-lg font-bold text-navy">{resumen.estadoLabel}</p>
        </div>
      </div>

      {proyecto.notas && (
        <div className="rounded-md border border-mist bg-white p-4 text-sm text-navy">
          {proyecto.notas}
        </div>
      )}

      <ObraAvancePanel
        proyectoId={id}
        rubrosProgreso={rubrosProgreso}
        resumen={resumen}
        onChange={(nextResumen, nextRubros) => {
          setResumen(nextResumen);
          setRubrosProgreso(nextRubros);
        }}
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(280px,340px)]">
        <section className="rounded-xl border border-mist bg-white p-4 shadow-sm sm:p-6">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="font-display font-bold text-navy">
                Historial de tickets
              </h3>
              <p className="text-sm text-slate2">
                Comprobantes y rendiciones cargadas a la fecha.
              </p>
            </div>
            <Button size="sm" asChild>
              <Link href={`/obras/${id}/carga`}>+ Cargar gasto</Link>
            </Button>
          </div>

          {gastos.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate2">
              No hay comprobantes cargados.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[520px] text-left text-sm">
                <thead>
                  <tr className="border-b border-mist text-xs uppercase text-slate2">
                    <th className="py-2 pr-3">Fecha</th>
                    <th className="py-2 pr-3">Rubro</th>
                    <th className="py-2 pr-3">Detalle</th>
                    <th className="py-2 pr-3 text-right">Monto</th>
                    <th className="py-2 w-10" />
                  </tr>
                </thead>
                <tbody>
                  {gastos.map((g) => (
                    <tr key={g.id} className="border-b border-mist/60">
                      <td className="py-2.5 pr-3 whitespace-nowrap">{g.fecha}</td>
                      <td className="py-2.5 pr-3">
                        <span className="rounded bg-green-50 px-2 py-0.5 text-xs font-medium text-green-900">
                          {rubroNombre(g.rubroId)}
                        </span>
                      </td>
                      <td className="max-w-[220px] truncate py-2.5 pr-3">
                        {g.detalle}
                      </td>
                      <td
                        className={cn(
                          "py-2.5 pr-3 text-right font-semibold whitespace-nowrap",
                          g.tipoComponente === "MANO_OBRA"
                            ? "text-blue-700"
                            : "text-navy",
                        )}
                      >
                        {formatMoney(g.montoTicket)}
                      </td>
                      <td className="py-2.5">
                        <button
                          type="button"
                          onClick={() => handleDeleteGasto(g.id)}
                          className="text-red-500 hover:text-red-700"
                          aria-label="Eliminar ticket"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <aside className="min-w-0 xl:sticky xl:top-4 xl:self-start">
          <ObraPendientesPanel
            proyectoId={id}
            tareas={tareas}
            onChange={() => load()}
          />
        </aside>
      </div>

      {proyecto.origenPresupuestoId && (
        <p className="text-sm text-brand">
          <Link href={`/obras/presupuestos/${proyecto.origenPresupuestoId}`}>
            Ver presupuesto origen
          </Link>
        </p>
      )}

      <ObraFotosPanel
        proyectoId={id}
        fotos={fotos}
        onChange={() => load()}
      />
    </div>
  );
}
