"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { FileDown } from "lucide-react";
import { obraApi } from "@/lib/obra/client-api";
import type { PresupuestoResumen } from "@/lib/obra/types";
import { ObraFotosPanel } from "@/components/obra/obra-fotos-panel";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

function formatMoney(value: number) {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(value);
}

const ESTADO_STYLE: Record<PresupuestoResumen["estado"], string> = {
  BORRADOR: "bg-slate-100 text-slate-700",
  ENVIADO: "bg-sky-100 text-sky-800",
  APROBADO: "bg-green-100 text-green-800",
  RECHAZADO: "bg-red-100 text-red-800",
  CONVERTIDO: "bg-brand/10 text-brand",
};

export default function ClientePortalPage() {
  const router = useRouter();
  const [data, setData] = useState<Awaited<
    ReturnType<typeof obraApi.getClientePortal>
  > | null>(null);
  const [loading, setLoading] = useState(true);
  const [respondingId, setRespondingId] = useState<string | null>(null);

  const load = () =>
    obraApi.getSession().then(({ session }) => {
      if (!session || session.role !== "cliente") {
        router.replace("/cliente/login");
        return null;
      }
      return obraApi.getClientePortal();
    });

  useEffect(() => {
    load()
      .then((d) => {
        if (d) setData(d);
      })
      .finally(() => setLoading(false));
  }, [router]);

  const handleLogout = async () => {
    await obraApi.logout();
    router.replace("/cliente/login");
  };

  const handleResponder = async (id: string, accion: "aprobar" | "rechazar") => {
    setRespondingId(id);
    try {
      await obraApi.responderPresupuestoCliente(id, accion);
      const refreshed = await obraApi.getClientePortal();
      setData(refreshed);
    } finally {
      setRespondingId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand border-t-transparent" />
      </div>
    );
  }

  if (!data) return null;

  const presupuestosPendientes = data.presupuestos.filter(
    (p) => p.estado === "ENVIADO",
  );

  return (
    <div className="min-h-screen bg-paper p-4 sm:p-8">
      <div className="mx-auto max-w-3xl space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase text-slate2">
              Portal cliente
            </p>
            <h1 className="font-display text-2xl font-bold text-navy">
              Hola, {data.cliente.nombre}
            </h1>
          </div>
          <Button variant="outline" size="sm" onClick={handleLogout}>
            Salir
          </Button>
        </div>

        {presupuestosPendientes.length > 0 && (
          <section className="space-y-4">
            <h2 className="font-display text-lg font-bold text-navy">
              Presupuestos pendientes de tu aprobación
            </h2>
            {presupuestosPendientes.map((p) => (
              <article
                key={p.id}
                className="rounded-xl border border-amber-200 bg-amber-50/50 p-5 shadow-sm"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="font-display font-bold text-navy">
                      {p.titulo}
                    </h3>
                    <p className="text-sm text-slate2">{p.direccionObra}</p>
                  </div>
                  <p className="text-xl font-bold text-brand">
                    {formatMoney(p.total)}
                  </p>
                </div>
                <p className="mt-2 text-sm text-slate2">
                  {p.rubrosCount} rubros · incluye contingencia
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button size="sm" asChild variant="outline">
                    <a href={obraApi.presupuestoPdfUrl(p.id)} download>
                      <FileDown className="mr-1.5 h-4 w-4" />
                      Ver PDF
                    </a>
                  </Button>
                  <Button
                    size="sm"
                    disabled={respondingId === p.id}
                    onClick={() => handleResponder(p.id, "aprobar")}
                  >
                    {respondingId === p.id ? "Procesando…" : "Aprobar presupuesto"}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-red-200 text-red-700"
                    disabled={respondingId === p.id}
                    onClick={() => handleResponder(p.id, "rechazar")}
                  >
                    Rechazar
                  </Button>
                </div>
              </article>
            ))}
          </section>
        )}

        {data.presupuestos.filter((p) => p.estado !== "ENVIADO").length > 0 && (
          <section className="space-y-3">
            <h2 className="font-display text-lg font-bold text-navy">
              Historial de presupuestos
            </h2>
            {data.presupuestos
              .filter((p) => p.estado !== "ENVIADO")
              .map((p) => (
                <article
                  key={p.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-mist bg-white p-4"
                >
                  <div>
                    <p className="font-medium text-navy">{p.titulo}</p>
                    <span
                      className={cn(
                        "mt-1 inline-block rounded-full px-2 py-0.5 text-[10px] font-bold uppercase",
                        ESTADO_STYLE[p.estado],
                      )}
                    >
                      {p.estadoLabel}
                    </span>
                  </div>
                  <p className="font-bold text-navy">{formatMoney(p.total)}</p>
                </article>
              ))}
          </section>
        )}

        <section className="space-y-4">
          <h2 className="font-display text-lg font-bold text-navy">Mis obras</h2>
          {data.proyectos.length === 0 ? (
            <p className="text-sm text-slate2">
              No tenés obras asignadas todavía.
            </p>
          ) : (
            data.proyectos.map((p) => (
              <article
                key={p.id}
                className="rounded-xl border border-mist bg-white p-5 shadow-sm"
              >
                <h3 className="font-display text-lg font-bold text-navy">
                  {p.nombre}
                </h3>
                <p className="text-sm text-slate2">{p.propiedadVinculada}</p>
                <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
                  <div>
                    <p className="text-xs text-slate2">Avance</p>
                    <p className="text-xl font-bold text-blue-600">
                      {p.porcentajeAvance}%
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-slate2">Estado</p>
                    <p className="font-semibold text-navy">{p.estadoLabel}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate2">Ejecución</p>
                    <p className="font-semibold text-navy">
                      {p.porcentajeGasto}%
                    </p>
                  </div>
                </div>
                {p.notas && (
                  <p className="mt-4 rounded-md bg-slate-50 p-3 text-sm text-navy">
                    {p.notas}
                  </p>
                )}
                {p.tareas.length > 0 && (
                  <ul className="mt-4 space-y-1 text-sm">
                    {p.tareas.map((t, i) => (
                      <li key={i} className="text-slate2">
                        {t.completada ? "✓" : "○"} {t.titulo}
                      </li>
                    ))}
                  </ul>
                )}
                {p.fotos.length > 0 && (
                  <div className="mt-4">
                    <ObraFotosPanel
                      proyectoId={p.id}
                      fotos={p.fotos}
                      onChange={() => {}}
                      readOnly
                    />
                  </div>
                )}
              </article>
            ))
          )}
        </section>
      </div>
    </div>
  );
}
