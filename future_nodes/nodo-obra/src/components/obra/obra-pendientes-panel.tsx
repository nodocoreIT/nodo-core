"use client";

import { useMemo, useState } from "react";
import {
  Calendar,
  CheckCircle2,
  Gavel,
  HardHat,
  Hourglass,
  Plus,
  Truck,
  Wallet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { FichaPendienteDialog } from "@/components/obra/ficha-pendiente-dialog";
import { obraApi } from "@/lib/obra/client-api";
import {
  formatFechaLimite,
  splitTareasPorSeccion,
  TAREA_TIPO_LABELS,
} from "@/lib/obra/tareas";
import type { LocalTarea, TareaTipo } from "@/lib/obra/types";
import { cn } from "@/lib/utils";

const TIPO_ICONS: Record<TareaTipo, React.ElementType> = {
  operativa: HardHat,
  propietario: Gavel,
  agenda: Calendar,
  logistica: Truck,
  caja: Wallet,
};

interface ObraPendientesPanelProps {
  proyectoId: string;
  tareas: LocalTarea[];
  onChange: () => void;
}

function PendienteItem({
  tarea,
  showTipo,
  toggling,
  onToggle,
}: {
  tarea: LocalTarea;
  showTipo?: boolean;
  toggling: boolean;
  onToggle: (id: string, completada: boolean) => void;
}) {
  const TipoIcon = TIPO_ICONS[tarea.tipo];
  const fechaLabel = formatFechaLimite(tarea.fechaLimite);

  return (
    <li
      className={cn(
        "flex items-start gap-3 rounded-md border px-3 py-2.5 text-sm transition-colors",
        tarea.completada
          ? "border-mist/80 bg-slate-50"
          : "border-mist bg-white",
      )}
    >
      <input
        type="checkbox"
        className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer accent-brand"
        checked={tarea.completada}
        disabled={toggling}
        onChange={(e) => onToggle(tarea.id, e.target.checked)}
      />
      <div className="min-w-0 flex-1">
        <p
          className={cn(
            "font-medium text-navy",
            tarea.completada && "text-slate2 line-through",
          )}
        >
          {tarea.titulo}
        </p>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          {showTipo && (
            <span className="inline-flex items-center gap-1 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-slate2">
              <TipoIcon className="h-3 w-3" />
              {TAREA_TIPO_LABELS[tarea.tipo]}
            </span>
          )}
          {fechaLabel && (
            <span className="text-[11px] text-amber-700">
              Vence {fechaLabel}
            </span>
          )}
        </div>
      </div>
      {tarea.completada ? (
        <CheckCircle2 className="h-4 w-4 shrink-0 text-green-600" />
      ) : (
        <Hourglass className="h-4 w-4 shrink-0 text-amber-500" />
      )}
    </li>
  );
}

function PendienteSection({
  title,
  icon: Icon,
  emptyLabel,
  items,
  showTipo,
  togglingId,
  onToggle,
  onAdd,
}: {
  title: string;
  icon: React.ElementType;
  emptyLabel: string;
  items: LocalTarea[];
  showTipo?: boolean;
  togglingId: string | null;
  onToggle: (id: string, completada: boolean) => void;
  onAdd: () => void;
}) {
  return (
    <section className="rounded-xl border border-mist bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 font-display text-sm font-bold text-navy">
          <Icon className="h-4 w-4 text-brand" />
          {title}
        </h3>
        <Button
          variant="outline"
          size="icon"
          className="h-7 w-7 shrink-0"
          onClick={onAdd}
          aria-label={`Agregar ${title.toLowerCase()}`}
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      {items.length === 0 ? (
        <p className="py-4 text-center text-sm text-slate2">{emptyLabel}</p>
      ) : (
        <ul className="space-y-2">
          {items.map((tarea) => (
            <PendienteItem
              key={tarea.id}
              tarea={tarea}
              showTipo={showTipo}
              toggling={togglingId === tarea.id}
              onToggle={onToggle}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

export function ObraPendientesPanel({
  proyectoId,
  tareas,
  onChange,
}: ObraPendientesPanelProps) {
  const { internas, propietario } = useMemo(
    () => splitTareasPorSeccion(tareas),
    [tareas],
  );

  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [dialog, setDialog] = useState<
    "requerimiento" | "interna" | "propietario" | null
  >(null);

  const handleToggle = async (id: string, completada: boolean) => {
    setTogglingId(id);
    try {
      await obraApi.updateTarea(id, { completada });
      onChange();
    } finally {
      setTogglingId(null);
    }
  };

  const pendientesAbiertos =
    internas.filter((t) => !t.completada).length +
    propietario.filter((t) => !t.completada).length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 rounded-xl border border-mist bg-slate-50 px-4 py-3">
        <div>
          <p className="text-xs font-semibold uppercase text-slate2">
            Pendientes de la obra
          </p>
          <p className="text-lg font-bold text-navy">
            {pendientesAbiertos} abierto{pendientesAbiertos === 1 ? "" : "s"}
          </p>
        </div>
        <Button size="sm" onClick={() => setDialog("requerimiento")}>
          Cargar requerimiento
        </Button>
      </div>

      <PendienteSection
        title="Pendientes internos"
        icon={HardHat}
        emptyLabel="Sin tareas internas pendientes."
        items={internas}
        showTipo
        togglingId={togglingId}
        onToggle={handleToggle}
        onAdd={() => setDialog("interna")}
      />

      <PendienteSection
        title="Definiciones propietario"
        icon={Gavel}
        emptyLabel="Sin definiciones pendientes del propietario."
        items={propietario}
        togglingId={togglingId}
        onToggle={handleToggle}
        onAdd={() => setDialog("propietario")}
      />

      <FichaPendienteDialog
        open={dialog === "requerimiento"}
        onOpenChange={(open) => !open && setDialog(null)}
        proyectoId={proyectoId}
        title="Cargar requerimiento"
        onSaved={onChange}
      />

      <FichaPendienteDialog
        open={dialog === "interna"}
        onOpenChange={(open) => !open && setDialog(null)}
        proyectoId={proyectoId}
        title="Nueva tarea interna"
        defaultTipo="operativa"
        allowedTipos={["operativa", "logistica", "agenda", "caja"]}
        showAgendaHora
        onSaved={onChange}
      />

      <FichaPendienteDialog
        open={dialog === "propietario"}
        onOpenChange={(open) => !open && setDialog(null)}
        proyectoId={proyectoId}
        title="Nueva definición del propietario"
        defaultTipo="propietario"
        allowedTipos={["propietario", "operativa"]}
        onSaved={onChange}
      />
    </div>
  );
}
