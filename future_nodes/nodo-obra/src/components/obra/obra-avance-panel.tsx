"use client";

import { useEffect, useState } from "react";
import { Layers } from "lucide-react";
import { ProgressRing } from "@/components/obra/progress-ring";
import { obraApi } from "@/lib/obra/client-api";
import type { ProyectoDashboard, RubroProgresoView } from "@/lib/obra/types";
import { cn } from "@/lib/utils";

function formatMoney(value: number) {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(value);
}

interface ObraAvancePanelProps {
  proyectoId: string;
  rubrosProgreso: RubroProgresoView[];
  resumen: ProyectoDashboard;
  onChange: (resumen: ProyectoDashboard, rubros: RubroProgresoView[]) => void;
}

export function ObraAvancePanel({
  proyectoId,
  rubrosProgreso,
  resumen,
  onChange,
}: ObraAvancePanelProps) {
  const [rubros, setRubros] = useState(rubrosProgreso);
  const [avanceGeneral, setAvanceGeneral] = useState(resumen.porcentajeAvance);
  const [porcentajeCaja, setPorcentajeCaja] = useState(resumen.porcentajeGasto);
  const [savingRubroId, setSavingRubroId] = useState<string | null>(null);
  const [draftAvanceManual, setDraftAvanceManual] = useState(
    String(resumen.porcentajeAvance),
  );

  useEffect(() => {
    setRubros(rubrosProgreso);
    setAvanceGeneral(resumen.porcentajeAvance);
    setPorcentajeCaja(resumen.porcentajeGasto);
    setDraftAvanceManual(String(resumen.porcentajeAvance));
  }, [rubrosProgreso, resumen]);

  const handleRubroChange = async (rubroId: string, value: number) => {
    setRubros((prev) =>
      prev.map((r) =>
        r.id === rubroId ? { ...r, porcentajeAvance: value } : r,
      ),
    );

    setSavingRubroId(rubroId);
    try {
      const result = await obraApi.updateAvance(proyectoId, {
        rubroId,
        porcentajeAvance: value,
      });
      setAvanceGeneral(result.nuevoAvanceGeneral);
      setDraftAvanceManual(String(result.nuevoAvanceGeneral));
      setPorcentajeCaja(result.resumen.porcentajeGasto);
      const refreshed = await obraApi.getProyecto(proyectoId);
      setRubros(refreshed.rubrosProgreso);
      onChange(result.resumen, refreshed.rubrosProgreso);
    } finally {
      setSavingRubroId(null);
    }
  };

  const handleAvanceManual = async () => {
    const value = Number(draftAvanceManual);
    if (Number.isNaN(value) || value < 0 || value > 100) return;

    const result = await obraApi.updateAvance(proyectoId, {
      porcentajeAvance: value,
    });
    setAvanceGeneral(result.nuevoAvanceGeneral);
    setDraftAvanceManual(String(result.nuevoAvanceGeneral));
    onChange(result.resumen, rubros);
  };

  const saldo = resumen.presupuestoEstimado - resumen.gastoReal;
  const cajaColor =
    porcentajeCaja > avanceGeneral + 15 || saldo < 0
      ? "text-red-600"
      : "text-blue-600";

  return (
    <section className="rounded-xl border border-mist bg-white p-4 shadow-sm sm:p-6">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h3 className="font-display font-bold text-navy">
            Progreso y gasto por rubro
          </h3>
          <p className="text-sm text-slate2">
            Mové los sliders para registrar el avance físico de cada rubro.
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-center">
            <p className="mb-1 text-[10px] font-bold uppercase text-slate2">
              Avance
            </p>
            <ProgressRing
              value={avanceGeneral}
              className="text-green-600"
              labelClassName="text-green-700"
            />
          </div>
          <div className="text-center">
            <p className="mb-1 text-[10px] font-bold uppercase text-slate2">
              Caja
            </p>
            <ProgressRing
              value={porcentajeCaja}
              className={cajaColor}
              labelClassName={cajaColor}
            />
          </div>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap items-end gap-2 rounded-lg border border-mist bg-slate-50 p-3">
        <div className="min-w-[120px] flex-1">
          <label
            htmlFor="avance-manual"
            className="mb-1 block text-xs font-semibold uppercase text-slate2"
          >
            Avance general manual
          </label>
          <input
            id="avance-manual"
            type="number"
            min={0}
            max={100}
            value={draftAvanceManual}
            onChange={(e) => setDraftAvanceManual(e.target.value)}
            className="flex h-9 w-full rounded-md border border-input bg-white px-3 text-sm"
          />
        </div>
        <button
          type="button"
          onClick={handleAvanceManual}
          className="h-9 rounded-md bg-brand px-3 text-sm font-medium text-white hover:bg-brand/90"
        >
          Guardar avance
        </button>
      </div>

      {rubros.length === 0 ? (
        <p className="text-sm text-slate2">
          No hay rubros cargados en esta obra.
        </p>
      ) : (
        <div className="space-y-4">
          {rubros.map((rubro) => (
            <div
              key={rubro.id}
              className="border-b border-mist/70 pb-4 last:border-b-0 last:pb-0"
            >
              <div className="mb-2 flex items-center justify-between gap-3">
                <span className="flex items-center gap-2 text-sm font-semibold uppercase text-navy">
                  <Layers className="h-3.5 w-3.5 text-slate2" />
                  {rubro.nombre}
                </span>
                <span className="text-sm font-bold text-slate2">
                  {formatMoney(rubro.montoGasto)}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={rubro.porcentajeAvance}
                  disabled={savingRubroId === rubro.id}
                  onChange={(e) =>
                    setRubros((prev) =>
                      prev.map((r) =>
                        r.id === rubro.id
                          ? {
                              ...r,
                              porcentajeAvance: Number(e.target.value),
                            }
                          : r,
                      ),
                    )
                  }
                  onMouseUp={(e) =>
                    handleRubroChange(
                      rubro.id,
                      Number((e.target as HTMLInputElement).value),
                    )
                  }
                  onTouchEnd={(e) =>
                    handleRubroChange(
                      rubro.id,
                      Number((e.target as HTMLInputElement).value),
                    )
                  }
                  className={cn(
                    "h-2 flex-1 cursor-pointer accent-brand",
                    savingRubroId === rubro.id && "opacity-60",
                  )}
                />
                <span className="min-w-[52px] rounded-md border border-green-200 bg-green-50 px-2 py-1 text-center text-xs font-bold text-green-800">
                  {rubro.porcentajeAvance}%
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
