"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  Calendar,
  FileSpreadsheet,
  Home,
  Plus,
  PlusCircle,
  TriangleAlert,
  Truck,
  Wallet,
} from "lucide-react";
import { obraApi } from "@/lib/obra/client-api";
import type { DashboardPayload, DashboardTarea, TareaTipo } from "@/lib/obra/types";
import { ObraCard } from "@/components/obra/obra-card";
import { QuickTaskDialog } from "@/components/obra/quick-task-dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

function formatMoney(value: number) {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(value);
}

type SidebarTab = "agenda" | "logistica" | "caja";

function TareaList({
  tareas,
  onToggle,
  onAdd,
}: {
  tareas: DashboardTarea[];
  onToggle: (id: string, completada: boolean) => void;
  onAdd: () => void;
}) {
  if (tareas.length === 0) {
    return (
      <div className="py-6 text-center">
        <p className="text-sm text-slate2">Sin pendientes</p>
        <Button variant="ghost" size="sm" className="mt-2" onClick={onAdd}>
          <Plus className="mr-1 h-3.5 w-3.5" />
          Agregar
        </Button>
      </div>
    );
  }

  return (
    <ul className="space-y-2">
      {tareas.map((t) => (
        <li
          key={t.id}
          className="flex items-start gap-2 rounded-md border border-mist bg-white px-3 py-2 text-sm"
        >
          <input
            type="checkbox"
            className="mt-1 shrink-0"
            checked={t.completada}
            onChange={(e) => onToggle(t.id, e.target.checked)}
          />
          <div className="min-w-0 flex-1">
            <p className="font-medium text-navy">{t.titulo}</p>
            <p className="text-xs text-brand">{t.proyectoNombre}</p>
            {t.fechaLimite && (
              <p className="text-xs text-slate2">Vence: {t.fechaLimite}</p>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}

export function DashboardView() {
  const [data, setData] = useState<DashboardPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<SidebarTab>("agenda");
  const [dialogTipo, setDialogTipo] = useState<TareaTipo | null>(null);
  const [presupuestosPendientes, setPresupuestosPendientes] = useState(0);

  const load = useCallback(() => {
    Promise.all([obraApi.getDashboard(), obraApi.getPresupuestos()])
      .then(([dashboard, presupuestosData]) => {
        setData(dashboard);
        setPresupuestosPendientes(
          presupuestosData.presupuestos.filter(
            (p) =>
              p.estado === "BORRADOR" ||
              p.estado === "ENVIADO" ||
              p.estado === "APROBADO",
          ).length,
        );
      })
      .catch(() => setError("No se pudo cargar el tablero."))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleToggleTarea = async (id: string, completada: boolean) => {
    await obraApi.updateTarea(id, { completada });
    load();
  };

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand border-t-transparent" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="rounded-md border border-red-200 bg-red-50 p-6 text-sm text-red-700">
        {error ?? "Error desconocido"}
      </div>
    );
  }

  const tabConfig: {
    id: SidebarTab;
    label: string;
    icon: React.ElementType;
    count: number;
    items: DashboardTarea[];
    color: string;
    tipo: TareaTipo;
    dialogTitle: string;
  }[] = [
    {
      id: "agenda",
      label: "Agenda",
      icon: Calendar,
      count: data.tareasAgenda.length,
      items: data.tareasAgenda,
      color: "text-sky-600",
      tipo: "agenda",
      dialogTitle: "Agendar evento / reunión",
    },
    {
      id: "logistica",
      label: "Logística",
      icon: Truck,
      count: data.tareasLogistica.length,
      items: data.tareasLogistica,
      color: "text-brand",
      tipo: "logistica",
      dialogTitle: "Nuevo pedido / material",
    },
    {
      id: "caja",
      label: "Cajas",
      icon: Wallet,
      count: data.tareasCaja.length,
      items: data.tareasCaja,
      color: "text-indigo-600",
      tipo: "caja",
      dialogTitle: "Recordatorio de rendición",
    },
  ];

  const activeTab = tabConfig.find((t) => t.id === tab)!;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        <Button asChild className="shrink-0">
          <Link href="/obras/nueva">
            <PlusCircle className="mr-2 h-4 w-4" />
            Crear proyecto
          </Link>
        </Button>
        <Button variant="outline" className="shrink-0" asChild>
          <Link href="/obras/presupuestos/nuevo">
            <FileSpreadsheet className="mr-2 h-4 w-4" />
            Nuevo presupuesto
          </Link>
        </Button>
        <Button
          variant="outline"
          className="shrink-0 border-red-200 text-red-700 hover:bg-red-50"
          onClick={() => setDialogTipo("operativa")}
        >
          <TriangleAlert className="mr-2 h-4 w-4" />
          Alerta obra
        </Button>
        <Button variant="outline" className="shrink-0" asChild>
          <Link href="/obras">
            <Home className="mr-2 h-4 w-4" />
            Inicio obras
          </Link>
        </Button>
        {data.obrasConDesvio > 0 && (
          <div className="flex w-full items-center gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 sm:w-auto">
            <TriangleAlert className="h-4 w-4 shrink-0" />
            {data.obrasConDesvio} obra(s) con desvío
          </div>
        )}
        {presupuestosPendientes > 0 && (
          <div className="flex w-full items-center justify-between gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 sm:w-auto">
            <span>
              {presupuestosPendientes} presupuesto
              {presupuestosPendientes === 1 ? "" : "s"} por cerrar
            </span>
            <Link href="/obras/presupuestos" className="font-semibold underline">
              Ver
            </Link>
          </div>
        )}
      </div>

      <div className="grid gap-4 rounded-xl border border-mist bg-white p-4 sm:grid-cols-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase text-slate2">
            Presupuesto total
          </p>
          <p className="text-lg font-bold text-navy sm:text-xl">
            {formatMoney(data.totales.presupuestoTotal)}
          </p>
        </div>
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase text-slate2">
            Gasto total
          </p>
          <p className="text-lg font-bold text-navy sm:text-xl">
            {formatMoney(data.totales.gastoTotal)}
          </p>
        </div>
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase text-slate2">
            Ejecución global
          </p>
          <p className="text-lg font-bold text-brand sm:text-xl">
            {data.totales.porcentajeGlobal}%
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-6 xl:grid xl:grid-cols-[minmax(0,1fr)_minmax(260px,300px)]">
        <div className="min-w-0">
          <h2 className="mb-4 font-display text-sm font-bold uppercase tracking-wide text-navy">
            Tablero de proyectos
          </h2>
          {data.obras.length === 0 ? (
            <p className="rounded-md border border-dashed border-mist py-12 text-center text-sm text-slate2">
              No hay proyectos registrados.
            </p>
          ) : (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              {data.obras.map((obra) => (
                <ObraCard key={obra.id} obra={obra} />
              ))}
            </div>
          )}
        </div>

        <aside className="min-w-0 rounded-xl border border-mist bg-slate-50 p-3 xl:sticky xl:top-4 xl:self-start">
          <div className="mb-3 flex gap-1 overflow-x-auto rounded-lg bg-mist/60 p-1">
            {tabConfig.map(({ id, label, icon: Icon, count, color }) => (
              <button
                key={id}
                type="button"
                onClick={() => setTab(id)}
                className={cn(
                  "relative flex min-w-[72px] flex-1 flex-col items-center rounded-md px-1 py-2 text-[10px] font-bold transition-colors",
                  tab === id
                    ? "bg-white text-navy shadow-sm"
                    : "text-slate2 hover:text-navy",
                )}
              >
                <Icon className={cn("mb-0.5 h-4 w-4", color)} />
                <span className="whitespace-nowrap">{label}</span>
                {count > 0 && (
                  <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand px-1 text-[9px] text-white">
                    {count}
                  </span>
                )}
              </button>
            ))}
          </div>

          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-sm font-bold text-navy">Pendientes</h3>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => setDialogTipo(activeTab.tipo)}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>

          <TareaList
            tareas={activeTab.items}
            onToggle={handleToggleTarea}
            onAdd={() => setDialogTipo(activeTab.tipo)}
          />
        </aside>
      </div>

      {dialogTipo && (
        <QuickTaskDialog
          open={!!dialogTipo}
          onOpenChange={(open) => !open && setDialogTipo(null)}
          tipo={dialogTipo === "operativa" ? "operativa" : dialogTipo}
          title={
            dialogTipo === "operativa"
              ? "Alerta / tarea urgente en obra"
              : tabConfig.find((t) => t.tipo === dialogTipo)?.dialogTitle ??
                "Nueva tarea"
          }
          obras={data.obras}
          onSaved={load}
        />
      )}
    </div>
  );
}
