"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { obraApi } from "@/lib/obra/client-api";
import type { LocalCliente } from "@/lib/obra/types";
import {
  PresupuestoForm,
  defaultPresupuestoFormValues,
  type PresupuestoFormValues,
} from "@/components/obra/presupuesto-form";

export default function NuevoPresupuestoPage() {
  const router = useRouter();
  const [clientes, setClientes] = useState<LocalCliente[]>([]);
  const [rubrosCatalogo, setRubrosCatalogo] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    obraApi
      .getPresupuestos()
      .then((d) => {
        setClientes(d.clientes);
        setRubrosCatalogo(d.rubrosCatalogo);
      })
      .finally(() => setLoading(false));
  }, []);

  const handleSubmit = async (values: PresupuestoFormValues, enviar: boolean) => {
    const { presupuesto } = await obraApi.createPresupuesto({
      titulo: values.titulo,
      clienteId: values.clienteId || null,
      direccionObra: values.direccionObra,
      tipoInmueble: values.tipoInmueble,
      plazoMeses: Number(values.plazoMeses) || 1,
      encargado: values.encargado,
      porcentajeContingencia: Number(values.porcentajeContingencia) || 0,
      notas: values.notas,
      inmoPropertyId: values.inmoPropertyId || null,
      inmoPropertyLabel: values.inmoPropertyLabel || null,
      estado: enviar ? "ENVIADO" : "BORRADOR",
      rubros: values.rubros,
    });
    router.push(`/obras/presupuestos/${presupuesto.id}`);
  };

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <div>
        <h2 className="font-display text-xl font-bold text-navy">
          Nuevo presupuesto
        </h2>
        <p className="text-sm text-slate2">
          Armá la cotización por rubros. Al aprobarla se crea la obra automáticamente.
        </p>
      </div>
      <PresupuestoForm
        initial={defaultPresupuestoFormValues(rubrosCatalogo)}
        clientes={clientes}
        rubrosCatalogo={rubrosCatalogo}
        onSubmit={handleSubmit}
      />
    </div>
  );
}
