"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { obraApi } from "@/lib/obra/client-api";
import type { PresupuestoResumen } from "@/lib/obra/types";
import { PresupuestoCard } from "@/components/obra/presupuesto-card";
import { Button } from "@/components/ui/button";

export default function PresupuestosListPage() {
  const [items, setItems] = useState<PresupuestoResumen[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    obraApi
      .getPresupuestos()
      .then((d) => setItems(d.presupuestos))
      .finally(() => setLoading(false));
  }, []);

  const pendientes = items.filter(
    (p) => p.estado === "BORRADOR" || p.estado === "ENVIADO" || p.estado === "APROBADO",
  );

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-bold text-navy">
            Presupuestos de obra
          </h2>
          <p className="text-sm text-slate2">
            Cotizá rubros, enviá al cliente y convertí en obra al aprobar.
          </p>
        </div>
        <Button asChild>
          <Link href="/obras/presupuestos/nuevo">Nuevo presupuesto</Link>
        </Button>
      </div>

      {pendientes.length > 0 && (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-900">
          {pendientes.length} presupuesto{pendientes.length === 1 ? "" : "s"} pendiente
          {pendientes.length === 1 ? "" : "s"} de cierre o conversión.
        </p>
      )}

      {items.length === 0 ? (
        <p className="rounded-md border border-dashed border-mist py-12 text-center text-sm text-slate2">
          Todavía no hay presupuestos. Creá el primero para cotizar una obra.
        </p>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {items.map((item) => (
            <PresupuestoCard key={item.id} item={item} />
          ))}
        </div>
      )}
    </div>
  );
}
