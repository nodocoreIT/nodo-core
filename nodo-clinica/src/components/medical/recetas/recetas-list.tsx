"use client";

import { useCallback, useEffect, useState } from "react";
import { Building2, FileText, Loader2, Mail, Pencil, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { clinicApi } from "@/lib/clinic/client-api";
import { currencySymbol } from "@/lib/clinic/currency";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type RecetaRow = Awaited<
  ReturnType<typeof clinicApi.getPrescriptionsByDoctor>
>["prescriptions"][number];

type RecetaStatus = "borrador" | "enviada" | "pagada";

function recetaStatus(row: RecetaRow): RecetaStatus {
  if (row.paymentStatus === "confirmed" || row.paymentStatus === "waived") {
    return "pagada";
  }
  if (row.sentAt) return "enviada";
  return "borrador";
}

const STATUS_BADGE: Record<RecetaStatus, { label: string; className: string }> = {
  borrador: {
    label: "Borrador",
    className: "bg-slate-100 text-slate-600 border-slate-200",
  },
  enviada: {
    label: "Enviada",
    className: "bg-amber-100 text-amber-900 border-amber-200",
  },
  pagada: {
    label: "Pagada",
    className: "bg-emerald-100 text-emerald-800 border-emerald-200",
  },
};

function formatMoney(amount: number | null, currency: string | null) {
  if (amount == null) return "—";
  return `${currencySymbol(currency)} ${amount.toLocaleString("es-AR")}`;
}

interface RecetasListProps {
  /** Fase 6 — called when the médico clicks "Editar" on a draft receta, so
   * the caller can open the form dialog in edit mode. Only shown for
   * recetas in "borrador" status. */
  onEdit?: (id: string) => void;
}

/** Fase 5 de "Recetas" — historial de recetas emitidas por el médico logueado,
 * con badge de estado (borrador/enviada/pagada) y botón de reenviar para las
 * que todavía no están pagadas. Fase 6 agrega "Editar" para los borradores. */
export function RecetasList({ onEdit }: RecetasListProps = {}) {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<RecetaRow[]>([]);
  const [resendingId, setResendingId] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    clinicApi
      .getPrescriptionsByDoctor()
      .then((data) => setRows(data.prescriptions))
      .catch((err) =>
        toast.error(err instanceof Error ? err.message : "No se pudieron cargar las recetas"),
      )
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleResend = async (id: string) => {
    setResendingId(id);
    try {
      await clinicApi.sendPrescription(id);
      toast.success("Receta reenviada por email al paciente");
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al reenviar la receta");
    } finally {
      setResendingId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <p className="text-sm text-slate-500 rounded-lg border border-dashed p-6 text-center">
        Todavía no emitiste ninguna receta.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {rows.map((row) => {
        const status = recetaStatus(row);
        const badge = STATUS_BADGE[status];
        const canResend = status !== "pagada";

        return (
          <div
            key={row.id}
            className="rounded-lg border border-slate-200 bg-white p-3 flex items-start justify-between gap-3"
          >
            <div className="min-w-0 space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-sm font-medium text-slate-900 flex items-center gap-1.5">
                  <User className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                  {row.patientFullName}
                </p>
                <span
                  className={cn(
                    "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold",
                    badge.className,
                  )}
                >
                  {badge.label}
                </span>
              </div>
              <div className="flex items-center gap-3 flex-wrap text-xs text-slate-500">
                {row.institutionSnapshot && (
                  <span className="flex items-center gap-1">
                    <Building2 className="h-3 w-3 shrink-0" />
                    {row.institutionSnapshot.name}
                  </span>
                )}
                <span className="font-medium text-slate-600">
                  {formatMoney(row.priceAmount, row.priceCurrency)}
                </span>
                <span>
                  {format(new Date(row.createdAt), "dd/MM/yyyy", { locale: es })}
                </span>
              </div>
            </div>

            {canResend && (
              <div className="flex items-center gap-1.5 shrink-0">
                {status === "borrador" && onEdit && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 px-2 text-[11px] gap-1"
                    onClick={() => onEdit(row.id)}
                  >
                    <Pencil className="h-3 w-3" />
                    Editar
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 px-2 text-[11px] gap-1"
                  disabled={resendingId === row.id}
                  onClick={() => void handleResend(row.id)}
                >
                  {resendingId === row.id ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <>
                      <Mail className="h-3 w-3" />
                      {status === "enviada" ? "Reenviar" : "Enviar"}
                    </>
                  )}
                </Button>
              </div>
            )}
            {!canResend && (
              <span className="flex items-center gap-1 text-[11px] text-emerald-700 shrink-0">
                <FileText className="h-3 w-3" />
                Pagada
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}
