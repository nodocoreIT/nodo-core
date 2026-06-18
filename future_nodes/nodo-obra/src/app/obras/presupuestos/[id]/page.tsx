"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowRight, CheckCircle2, FileDown } from "lucide-react";
import { obraApi } from "@/lib/obra/client-api";
import type { LocalCliente, LocalPresupuesto, PresupuestoResumen } from "@/lib/obra/types";
import {
  PresupuestoForm,
  type PresupuestoFormValues,
} from "@/components/obra/presupuesto-form";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

function toFormValues(p: LocalPresupuesto): PresupuestoFormValues {
  return {
    titulo: p.titulo,
    clienteId: p.clienteId ?? "",
    direccionObra: p.direccionObra,
    tipoInmueble: p.tipoInmueble,
    plazoMeses: String(p.plazoMeses),
    encargado: p.encargado,
    porcentajeContingencia: String(p.porcentajeContingencia),
    notas: p.notas,
    inmoPropertyId: p.inmoPropertyId ?? "",
    inmoPropertyLabel: p.inmoPropertyLabel ?? "",
    rubros: p.rubros,
  };
}

export default function PresupuestoDetallePage() {
  const params = useParams();
  const router = useRouter();
  const id = String(params.id);

  const [presupuesto, setPresupuesto] = useState<LocalPresupuesto | null>(null);
  const [resumen, setResumen] = useState<PresupuestoResumen | null>(null);
  const [clientes, setClientes] = useState<LocalCliente[]>([]);
  const [rubrosCatalogo, setRubrosCatalogo] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = () =>
    obraApi.getPresupuesto(id).then((d) => {
      setPresupuesto(d.presupuesto);
      setResumen(d.resumen);
      setRubrosCatalogo(d.rubrosCatalogo);
      return obraApi.getPresupuestos();
    }).then((d) => setClientes(d.clientes));

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, [id]);

  const handleSave = async (values: PresupuestoFormValues, enviar: boolean) => {
    const data = await obraApi.updatePresupuesto(id, {
      titulo: values.titulo,
      direccionObra: values.direccionObra,
      tipoInmueble: values.tipoInmueble,
      encargado: values.encargado,
      notas: values.notas,
      rubros: values.rubros,
      plazoMeses: Number(values.plazoMeses) || 1,
      porcentajeContingencia: Number(values.porcentajeContingencia) || 0,
      clienteId: values.clienteId || null,
      inmoPropertyId: values.inmoPropertyId || null,
      inmoPropertyLabel: values.inmoPropertyLabel || null,
      estado: enviar ? "ENVIADO" : "BORRADOR",
    });
    setPresupuesto(data.presupuesto);
    setResumen(data.resumen);
  };

  const handleAprobarObra = async () => {
    setActionLoading(true);
    setError(null);
    try {
      const data = await obraApi.aprobarPresupuesto(id);
      router.push(`/obras/${data.proyecto.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo crear la obra");
    } finally {
      setActionLoading(false);
    }
  };

  const handleRechazar = async () => {
    if (!confirm("¿Marcar este presupuesto como rechazado?")) return;
    setActionLoading(true);
    try {
      const data = await obraApi.updatePresupuesto(id, { estado: "RECHAZADO" });
      setPresupuesto(data.presupuesto);
      setResumen(data.resumen);
    } finally {
      setActionLoading(false);
    }
  };

  const handleMarcarAprobado = async () => {
    setActionLoading(true);
    try {
      const data = await obraApi.updatePresupuesto(id, { estado: "APROBADO" });
      setPresupuesto(data.presupuesto);
      setResumen(data.resumen);
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand border-t-transparent" />
      </div>
    );
  }

  if (!presupuesto || !resumen) {
    return <p className="text-sm text-red-600">Presupuesto no encontrado.</p>;
  }

  const readOnly = presupuesto.estado === "CONVERTIDO" || presupuesto.estado === "RECHAZADO";
  const puedeConvertir =
    presupuesto.estado !== "CONVERTIDO" &&
    presupuesto.estado !== "RECHAZADO" &&
    !presupuesto.proyectoId;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase text-slate2">
            Presupuesto · {resumen.estadoLabel}
          </p>
          <h2 className="font-display text-2xl font-bold text-navy">
            {presupuesto.titulo}
          </h2>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" asChild>
            <a href={obraApi.presupuestoPdfUrl(id)} download>
              <FileDown className="mr-1.5 h-4 w-4" />
              Descargar PDF
            </a>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link href="/obras/presupuestos">Volver al listado</Link>
          </Button>
        </div>
      </div>

      {presupuesto.estado === "CONVERTIDO" && presupuesto.proyectoId && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-green-200 bg-green-50 p-4">
          <div className="flex items-center gap-2 text-green-800">
            <CheckCircle2 className="h-5 w-5" />
            <span className="text-sm font-medium">
              Este presupuesto ya generó una obra activa.
            </span>
          </div>
          <Button size="sm" asChild>
            <Link href={`/obras/${presupuesto.proyectoId}`}>
              Abrir obra
              <ArrowRight className="ml-1 h-4 w-4" />
            </Link>
          </Button>
        </div>
      )}

      {puedeConvertir && (
        <div className="rounded-xl border border-mist bg-slate-50 p-4">
          <h3 className="mb-2 font-display font-bold text-navy">
            Cierre comercial
          </h3>
          <p className="mb-4 text-sm text-slate2">
            Cuando el cliente apruebe, convertí el presupuesto en obra. Se cargan
            rubros, tareas presupuestadas y el monto total automáticamente.
          </p>
          {error && <p className="mb-3 text-sm text-red-600">{error}</p>}
          <div className="flex flex-wrap gap-2">
            {presupuesto.estado !== "APROBADO" && (
              <Button
                variant="outline"
                disabled={actionLoading}
                onClick={handleMarcarAprobado}
              >
                Marcar aprobado
              </Button>
            )}
            <Button disabled={actionLoading} onClick={handleAprobarObra}>
              {actionLoading ? "Creando obra…" : "Aprobar y crear obra"}
            </Button>
            <Button
              variant="outline"
              className={cn("border-red-200 text-red-700 hover:bg-red-50")}
              disabled={actionLoading}
              onClick={handleRechazar}
            >
              Rechazar
            </Button>
          </div>
        </div>
      )}

      <PresupuestoForm
        initial={toFormValues(presupuesto)}
        clientes={clientes}
        rubrosCatalogo={rubrosCatalogo}
        readOnly={readOnly}
        onSubmit={handleSave}
      />
    </div>
  );
}
