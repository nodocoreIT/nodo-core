"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { obraApi } from "@/lib/obra/client-api";
import type { LocalGasto, LocalRubro } from "@/lib/obra/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

function formatMoney(value: number) {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(value);
}

export default function CargaRapidaPage() {
  const params = useParams();
  const router = useRouter();
  const obraId = String(params.id);

  const [obraNombre, setObraNombre] = useState("");
  const [gastos, setGastos] = useState<LocalGasto[]>([]);
  const [rubros, setRubros] = useState<LocalRubro[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    rubroId: "",
    detalle: "",
    montoTicket: "",
    fecha: new Date().toISOString().slice(0, 10),
    esManoObra: false,
  });

  const load = () => {
    Promise.all([
      obraApi.getProyecto(obraId),
      obraApi.getGastos(obraId),
    ])
      .then(([proyectoData, gastosData]) => {
        setObraNombre(proyectoData.proyecto.nombre);
        setGastos(gastosData.gastos);
        setRubros(gastosData.rubros);
        if (gastosData.rubros[0]) {
          setForm((f) => ({ ...f, rubroId: f.rubroId || gastosData.rubros[0].id }));
        }
      })
      .catch(() => router.replace("/obras"))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [obraId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await obraApi.createGasto({
        proyectoId: obraId,
        rubroId: form.rubroId || null,
        detalle: form.detalle,
        montoTicket: Number(form.montoTicket),
        fecha: form.fecha,
        tipoComponente: form.esManoObra ? "MANO_OBRA" : "MATERIALES",
      });
      setForm((f) => ({
        ...f,
        detalle: "",
        montoTicket: "",
        esManoObra: false,
      }));
      const refreshed = await obraApi.getGastos(obraId);
      setGastos(refreshed.gastos);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (gastoId: string) => {
    if (!confirm("¿Borrar este ticket?")) return;
    await obraApi.deleteGasto(gastoId);
    const refreshed = await obraApi.getGastos(obraId);
    setGastos(refreshed.gastos);
  };

  const rubroNombre = (id: string | null) =>
    rubros.find((r) => r.id === id)?.nombre ?? "General";

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase text-slate2">
            Carga rápida
          </p>
          <h2 className="font-display text-xl font-bold text-navy">
            {obraNombre}
          </h2>
        </div>
        <Button variant="outline" size="sm" asChild>
          <Link href={`/obras/${obraId}`}>Volver a ficha</Link>
        </Button>
      </div>

      <form
        onSubmit={handleSubmit}
        className="rounded-xl border border-mist bg-white p-4 shadow-sm sm:p-6"
      >
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="space-y-2 sm:col-span-1">
            <Label>Rubro</Label>
            <select
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={form.rubroId}
              onChange={(e) => setForm({ ...form, rubroId: e.target.value })}
              required
            >
              <option value="">Elegir…</option>
              {rubros.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.nombre}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2 lg:col-span-2">
            <Label>Detalle</Label>
            <Input
              value={form.detalle}
              onChange={(e) => setForm({ ...form, detalle: e.target.value })}
              required
            />
          </div>
          <div className="space-y-2">
            <Label>Monto $</Label>
            <Input
              type="number"
              min={0}
              step="0.01"
              value={form.montoTicket}
              onChange={(e) =>
                setForm({ ...form, montoTicket: e.target.value })
              }
              required
            />
          </div>
          <div className="space-y-2">
            <Label>Fecha</Label>
            <Input
              type="date"
              value={form.fecha}
              onChange={(e) => setForm({ ...form, fecha: e.target.value })}
            />
          </div>
          <div className="flex items-end pb-2">
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.esManoObra}
                onChange={(e) =>
                  setForm({ ...form, esManoObra: e.target.checked })
                }
                className="h-4 w-4"
              />
              ¿Mano de obra?
            </label>
          </div>
        </div>
        <Button type="submit" className="mt-4 w-full sm:w-auto" disabled={saving}>
          {saving ? "Registrando…" : "Registrar gasto"}
        </Button>
      </form>

      <section className="rounded-xl border border-mist bg-white p-4 shadow-sm sm:p-6">
        <h3 className="font-display font-bold text-navy">
          Historial de tickets
        </h3>
        <p className="mb-4 text-sm text-slate2">
          Comprobantes y rendiciones cargadas.
        </p>

        {gastos.length === 0 ? (
          <p className="text-sm text-slate2">Sin gastos registrados.</p>
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
                    <td className="py-2.5 pr-3 max-w-[200px] truncate">
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
                        onClick={() => handleDelete(g.id)}
                        className="text-red-500 hover:text-red-700"
                        aria-label="Eliminar"
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
    </div>
  );
}
