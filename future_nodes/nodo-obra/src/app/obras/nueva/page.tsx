"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { obraApi } from "@/lib/obra/client-api";
import type { LocalCliente } from "@/lib/obra/types";
import { InmoPropertySelect } from "@/components/obra/inmo-property-select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function NuevaObraPage() {
  const router = useRouter();
  const [clientes, setClientes] = useState<LocalCliente[]>([]);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    nombre: "",
    direccionObra: "",
    clienteId: "",
    presupuestoEstimado: "",
    encargado: "",
    plazoMeses: "3",
    inmoPropertyId: "",
    inmoPropertyLabel: "",
  });

  useEffect(() => {
    obraApi.getProyectos().then((d) => setClientes(d.clientes));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { proyecto } = await obraApi.createProyecto({
        nombre: form.nombre,
        direccionObra: form.direccionObra,
        clienteId: form.clienteId || null,
        presupuestoEstimado: Number(form.presupuestoEstimado) || 0,
        encargado: form.encargado,
        plazoMeses: Number(form.plazoMeses) || 1,
        inmoPropertyId: form.inmoPropertyId || null,
        inmoPropertyLabel: form.inmoPropertyLabel || null,
        estado: "PLAN",
      });
      router.push(`/obras/${proyecto.id}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-xl rounded-md border border-mist bg-white p-6 shadow-sm">
      <h2 className="font-display text-xl font-bold text-navy">Nueva obra</h2>
      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        <div className="space-y-2">
          <Label htmlFor="nombre">Nombre del proyecto</Label>
          <Input
            id="nombre"
            value={form.nombre}
            onChange={(e) => setForm({ ...form, nombre: e.target.value })}
            required
          />
        </div>
        <InmoPropertySelect
          value={form.inmoPropertyId}
          label="Propiedad nodo-inmo (opcional)"
          onChange={(propertyId, propertyLabel, property) => {
            setForm((f) => ({
              ...f,
              inmoPropertyId: propertyId,
              inmoPropertyLabel: propertyLabel,
              direccionObra: property?.address ?? f.direccionObra,
            }));
          }}
        />
        <div className="space-y-2">
          <Label htmlFor="direccion">Dirección de la obra</Label>
          <Input
            id="direccion"
            value={form.direccionObra}
            onChange={(e) =>
              setForm({ ...form, direccionObra: e.target.value })
            }
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="cliente">Cliente</Label>
          <select
            id="cliente"
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
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
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="presupuesto">Presupuesto estimado</Label>
            <Input
              id="presupuesto"
              type="number"
              min={0}
              value={form.presupuestoEstimado}
              onChange={(e) =>
                setForm({ ...form, presupuestoEstimado: e.target.value })
              }
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="plazo">Plazo (meses)</Label>
            <Input
              id="plazo"
              type="number"
              min={1}
              value={form.plazoMeses}
              onChange={(e) => setForm({ ...form, plazoMeses: e.target.value })}
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="encargado">Encargado</Label>
          <Input
            id="encargado"
            value={form.encargado}
            onChange={(e) => setForm({ ...form, encargado: e.target.value })}
          />
        </div>
        <Button type="submit" disabled={loading} className="w-full">
          {loading ? "Guardando…" : "Crear obra"}
        </Button>
      </form>
    </div>
  );
}
