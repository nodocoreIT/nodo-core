"use client";

import { useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { InmoPropertySelect } from "@/components/obra/inmo-property-select";
import { totalPresupuesto } from "@/lib/obra/presupuestos";
import type { LocalCliente, PresupuestoRubroLine } from "@/lib/obra/types";

export interface PresupuestoFormValues {
  titulo: string;
  clienteId: string;
  direccionObra: string;
  tipoInmueble: string;
  plazoMeses: string;
  encargado: string;
  porcentajeContingencia: string;
  notas: string;
  inmoPropertyId: string;
  inmoPropertyLabel: string;
  rubros: PresupuestoRubroLine[];
}

interface PresupuestoFormProps {
  initial: PresupuestoFormValues;
  clientes: LocalCliente[];
  rubrosCatalogo: string[];
  readOnly?: boolean;
  onSubmit: (values: PresupuestoFormValues, enviar: boolean) => Promise<void>;
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(value);
}

function newRubroLine(nombre = ""): PresupuestoRubroLine {
  return {
    id: crypto.randomUUID(),
    rubroNombre: nombre,
    manoObra: 0,
    materiales: 0,
    notas: "",
  };
}

function validateForm(form: PresupuestoFormValues): string | null {
  if (!form.titulo.trim()) return "El título es requerido";
  if (!form.direccionObra.trim()) return "La dirección de la obra es requerida";
  const rubrosValidos = form.rubros.filter((r) => r.rubroNombre.trim());
  if (rubrosValidos.length === 0) return "Agregá al menos un rubro con nombre";
  return null;
}

export function PresupuestoForm({
  initial,
  clientes,
  rubrosCatalogo,
  readOnly = false,
  onSubmit,
}: PresupuestoFormProps) {
  const [form, setForm] = useState(initial);
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const totales = useMemo(
    () =>
      totalPresupuesto(
        form.rubros,
        Number(form.porcentajeContingencia) || 0,
      ),
    [form.rubros, form.porcentajeContingencia],
  );

  const updateRubro = (
    id: string,
    patch: Partial<PresupuestoRubroLine>,
  ) => {
    setForm((f) => ({
      ...f,
      rubros: f.rubros.map((r) => (r.id === id ? { ...r, ...patch } : r)),
    }));
  };

  const handleSubmit = async (enviar: boolean) => {
    const validationError = validateForm(form);
    if (validationError) {
      setFormError(validationError);
      toast.error(validationError);
      return;
    }

    setFormError(null);
    setLoading(true);
    try {
      await onSubmit(form, enviar);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "No se pudo guardar el presupuesto";
      setFormError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {formError && (
        <p
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
        >
          {formError}
        </p>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="titulo">Título del presupuesto</Label>
          <Input
            id="titulo"
            value={form.titulo}
            disabled={readOnly}
            onChange={(e) => setForm({ ...form, titulo: e.target.value })}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="cliente">Cliente</Label>
          <select
            id="cliente"
            disabled={readOnly}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            value={form.clienteId}
            onChange={(e) => setForm({ ...form, clienteId: e.target.value })}
          >
            <option value="">Sin cliente</option>
            {clientes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="tipo">Tipo de inmueble</Label>
          <Input
            id="tipo"
            disabled={readOnly}
            value={form.tipoInmueble}
            onChange={(e) =>
              setForm({ ...form, tipoInmueble: e.target.value })
            }
          />
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="direccion">Dirección de la obra</Label>
          <Input
            id="direccion"
            disabled={readOnly}
            value={form.direccionObra}
            onChange={(e) =>
              setForm({ ...form, direccionObra: e.target.value })
            }
            required
          />
        </div>
        <div className="space-y-2 sm:col-span-2">
          <InmoPropertySelect
            disabled={readOnly}
            value={form.inmoPropertyId}
            label="Propiedad nodo-inmo"
            onChange={(propertyId, propertyLabel, property) => {
              setForm((f) => ({
                ...f,
                inmoPropertyId: propertyId,
                inmoPropertyLabel: propertyLabel,
                direccionObra: property?.address ?? f.direccionObra,
                tipoInmueble: property?.propertyType ?? f.tipoInmueble,
                titulo:
                  f.titulo.trim() || !property
                    ? f.titulo
                    : `Presupuesto ${property.address.split(",")[0]?.trim() ?? property.address}`,
              }));
              setFormError(null);
            }}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="plazo">Plazo (meses)</Label>
          <Input
            id="plazo"
            type="number"
            min={1}
            disabled={readOnly}
            value={form.plazoMeses}
            onChange={(e) => setForm({ ...form, plazoMeses: e.target.value })}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="encargado">Encargado</Label>
          <Input
            id="encargado"
            disabled={readOnly}
            value={form.encargado}
            onChange={(e) => setForm({ ...form, encargado: e.target.value })}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="contingencia">Contingencia %</Label>
          <Input
            id="contingencia"
            type="number"
            min={0}
            max={100}
            disabled={readOnly}
            value={form.porcentajeContingencia}
            onChange={(e) =>
              setForm({ ...form, porcentajeContingencia: e.target.value })
            }
          />
        </div>
      </div>

      <section className="rounded-xl border border-mist bg-white p-4">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-display font-bold text-navy">Rubros</h3>
          {!readOnly && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() =>
                setForm((f) => ({
                  ...f,
                  rubros: [...f.rubros, newRubroLine()],
                }))
              }
            >
              <Plus className="mr-1 h-4 w-4" />
              Rubro
            </Button>
          )}
        </div>

        <div className="space-y-3">
          {form.rubros.map((rubro) => (
            <div
              key={rubro.id}
              className="grid gap-3 rounded-lg border border-mist p-3 sm:grid-cols-[1fr_120px_120px_auto]"
            >
              <div className="space-y-1 sm:col-span-1">
                <Label className="text-xs">Rubro</Label>
                <select
                  disabled={readOnly}
                  className="flex h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                  value={rubro.rubroNombre}
                  onChange={(e) =>
                    updateRubro(rubro.id, { rubroNombre: e.target.value })
                  }
                >
                  <option value="">Elegir…</option>
                  {rubrosCatalogo.map((nombre) => (
                    <option key={nombre} value={nombre}>
                      {nombre}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">M.O. $</Label>
                <Input
                  type="number"
                  min={0}
                  disabled={readOnly}
                  value={rubro.manoObra || ""}
                  onChange={(e) =>
                    updateRubro(rubro.id, {
                      manoObra: Number(e.target.value) || 0,
                    })
                  }
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Mat. $</Label>
                <Input
                  type="number"
                  min={0}
                  disabled={readOnly}
                  value={rubro.materiales || ""}
                  onChange={(e) =>
                    updateRubro(rubro.id, {
                      materiales: Number(e.target.value) || 0,
                    })
                  }
                />
              </div>
              {!readOnly && (
                <div className="flex items-end">
                  <button
                    type="button"
                    className="text-red-500 hover:text-red-700"
                    onClick={() =>
                      setForm((f) => ({
                        ...f,
                        rubros: f.rubros.filter((r) => r.id !== rubro.id),
                      }))
                    }
                    aria-label="Quitar rubro"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      <div className="grid gap-3 rounded-xl border border-mist bg-slate-50 p-4 sm:grid-cols-3">
        <div>
          <p className="text-xs uppercase text-slate2">Subtotal</p>
          <p className="text-lg font-bold text-navy">
            {formatMoney(totales.subtotal)}
          </p>
        </div>
        <div>
          <p className="text-xs uppercase text-slate2">Contingencia</p>
          <p className="text-lg font-bold text-navy">
            {formatMoney(totales.contingencia)}
          </p>
        </div>
        <div>
          <p className="text-xs uppercase text-slate2">Total presupuesto</p>
          <p className="text-xl font-bold text-brand">
            {formatMoney(totales.total)}
          </p>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="notas">Notas</Label>
        <Textarea
          id="notas"
          disabled={readOnly}
          value={form.notas}
          onChange={(e) => setForm({ ...form, notas: e.target.value })}
          rows={3}
        />
      </div>

      {!readOnly && (
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            disabled={loading}
            onClick={() => handleSubmit(false)}
          >
            {loading ? "Guardando…" : "Guardar borrador"}
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={loading}
            onClick={() => handleSubmit(true)}
          >
            Guardar y enviar
          </Button>
        </div>
      )}
    </div>
  );
}

export function defaultPresupuestoFormValues(
  rubrosCatalogo: string[],
): PresupuestoFormValues {
  return {
    titulo: "",
    clienteId: "",
    direccionObra: "",
    tipoInmueble: "Casa",
    plazoMeses: "3",
    encargado: "",
    porcentajeContingencia: "10",
    notas: "",
    inmoPropertyId: "",
    inmoPropertyLabel: "",
    rubros: rubrosCatalogo.slice(0, 4).map((nombre) => newRubroLine(nombre)),
  };
}
