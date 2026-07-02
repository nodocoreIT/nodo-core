"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CheckCircle,
  CreditCard,
  ExternalLink,
  FileText,
  Loader2,
  Receipt,
  XCircle,
  Clock,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { clinicApi } from "@/lib/clinic/client-api";
import type { PaymentReceiptAudit } from "@/lib/clinic/local-db";
import { formatReceiptDateDisplay } from "@/lib/clinic/cobros-receipt";
import { format, isToday, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface DoctorCobrosListProps {
  doctorId: string;
  onPendingChange?: () => void;
}

type CobroRow = {
  id: string;
  patientName: string;
  scheduledAt: string;
  paymentStatus?: string;
  paymentProvider?: "transfer" | "mercadopago";
  audit?: PaymentReceiptAudit;
  needsReview?: boolean;
  documents?: Array<{ id: string; fileName: string; downloadUrl: string }>;
};

function formatMoney(amount: number, currency = "ARS") {
  return `${currency} ${amount.toLocaleString("es-AR")}`;
}

function providerLabel(provider?: CobroRow["paymentProvider"]) {
  if (provider === "mercadopago") return "MP";
  if (provider === "transfer") return "Transf.";
  return "Pago";
}

function validationLabel(row: CobroRow): {
  text: string;
  className: string;
  icon: "ok" | "bad" | "pending" | "manual";
} {
  if (row.needsReview) {
    return {
      text: "Pendiente",
      className: "bg-amber-100 text-amber-900 border-amber-200",
      icon: "pending",
    };
  }
  if (row.audit?.valid) {
    return {
      text: "OK",
      className: "bg-emerald-100 text-emerald-800 border-emerald-200",
      icon: "ok",
    };
  }
  if (row.paymentStatus === "confirmed") {
    return {
      text: "Aprobado",
      className: "bg-sky-100 text-sky-800 border-sky-200",
      icon: "manual",
    };
  }
  if (row.audit && !row.audit.valid) {
    return {
      text: "No coincide",
      className: "bg-red-100 text-red-800 border-red-200",
      icon: "bad",
    };
  }
  return {
    text: "—",
    className: "bg-slate-100 text-slate-600 border-slate-200",
    icon: "pending",
  };
}

function StatusIcon({ kind }: { kind: ReturnType<typeof validationLabel>["icon"] }) {
  if (kind === "ok" || kind === "manual") {
    return <CheckCircle className="h-3.5 w-3.5 shrink-0" />;
  }
  if (kind === "bad") {
    return <XCircle className="h-3.5 w-3.5 shrink-0" />;
  }
  return <Clock className="h-3.5 w-3.5 shrink-0" />;
}

export function DoctorCobrosList({
  doctorId,
  onPendingChange,
}: DoctorCobrosListProps) {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<CobroRow[]>([]);
  const [actingId, setActingId] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    clinicApi
      .getPaymentLedger(doctorId)
      .then((data) => setRows(data.entries ?? []))
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  }, [doctorId]);

  useEffect(() => {
    load();
    const interval = window.setInterval(load, 20_000);
    return () => window.clearInterval(interval);
  }, [load]);

  const pendingCount = rows.filter((r) => r.needsReview).length;

  const { todayTotal, allConfirmedTotal } = useMemo(() => {
    let today = 0;
    let all = 0;
    for (const row of rows) {
      if (row.needsReview) continue;
      const amt =
        row.audit?.amount ??
        (row.paymentStatus === "confirmed" ? row.audit?.expectedAmount : 0) ??
        0;
      if (amt <= 0) continue;
      all += amt;
      const refDate = row.audit?.transferDate
        ? parseISO(row.audit.transferDate)
        : new Date(row.scheduledAt);
      if (!Number.isNaN(refDate.getTime()) && isToday(refDate)) {
        today += amt;
      }
    }
    return { todayTotal: today, allConfirmedTotal: all };
  }, [rows]);

  const handleConfirm = async (appointmentId: string) => {
    setActingId(appointmentId);
    try {
      await clinicApi.doctorConfirmPayment(appointmentId);
      toast.success("Pago aprobado — turno habilitado");
      load();
      onPendingChange?.();
      window.dispatchEvent(new CustomEvent("cobros-notifications-read"));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al confirmar");
    } finally {
      setActingId(null);
    }
  };

  const handleReject = async (appointmentId: string) => {
    if (
      !window.confirm(
        "¿Rechazar este comprobante? Se cancelará el turno.",
      )
    ) {
      return;
    }
    setActingId(appointmentId);
    try {
      await clinicApi.doctorRejectPayment(appointmentId);
      toast.success("Pago rechazado");
      load();
      onPendingChange?.();
      window.dispatchEvent(new CustomEvent("cobros-notifications-read"));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al rechazar");
    } finally {
      setActingId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <p className="text-sm text-slate-500 rounded-lg border border-dashed p-6 text-center">
        Todavía no hay comprobantes ni cobros. Cuando un paciente suba un
        comprobante o pague, aparecerá acá en una sola fila por turno.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3 text-sm">
        {pendingCount > 0 && (
          <Badge className="bg-red-500 hover:bg-red-500 text-white">
            {pendingCount} pendiente{pendingCount === 1 ? "" : "s"}
          </Badge>
        )}
        {todayTotal > 0 && (
          <span className="text-slate-600">
            Hoy:{" "}
            <strong className="text-emerald-800">
              {formatMoney(todayTotal)}
            </strong>
          </span>
        )}
        {allConfirmedTotal > 0 && (
          <span className="text-slate-500">
            Total confirmado: {formatMoney(allConfirmedTotal)}
          </span>
        )}
      </div>

      <div className="overflow-x-auto rounded-lg border border-mist">
        <table className="w-full text-sm min-w-[880px]">
          <thead>
            <tr className="border-b bg-slate-50 text-left text-[11px] uppercase tracking-wide text-slate-500">
              <th className="px-3 py-2 font-semibold">Paciente</th>
              <th className="px-3 py-2 font-semibold whitespace-nowrap">
                Fecha comprobante
              </th>
              <th className="px-3 py-2 font-semibold whitespace-nowrap">
                Validación
              </th>
              <th className="px-3 py-2 font-semibold whitespace-nowrap">
                Monto
              </th>
              <th className="px-3 py-2 font-semibold whitespace-nowrap">
                Comprobante
              </th>
              <th className="px-3 py-2 font-semibold text-right whitespace-nowrap">
                Acción
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-mist">
            {rows.map((row) => {
              const receiptDate = formatReceiptDateDisplay(
                row.audit?.transferDate,
                row.audit?.transferTime,
              );
              const status = validationLabel(row);
              const readAmount = row.audit?.amount;
              const expected = row.audit?.expectedAmount;
              const doc = row.documents?.[0];

              return (
                <tr
                  key={row.id}
                  className={cn(
                    "bg-white hover:bg-slate-50/70",
                    row.needsReview && "bg-amber-50/30",
                  )}
                >
                  <td className="px-3 py-2.5 align-middle">
                    <div className="font-medium text-navy truncate max-w-[160px]">
                      {row.patientName}
                    </div>
                    <div className="flex items-center gap-1.5 mt-0.5 text-[10px] text-slate-400">
                      {row.paymentProvider === "mercadopago" ? (
                        <CreditCard className="h-3 w-3" />
                      ) : (
                        <Receipt className="h-3 w-3" />
                      )}
                      {providerLabel(row.paymentProvider)} · Turno{" "}
                      {format(new Date(row.scheduledAt), "dd/MM HH:mm", {
                        locale: es,
                      })}
                    </div>
                  </td>

                  <td className="px-3 py-2.5 align-middle whitespace-nowrap text-slate-600">
                    {receiptDate ?? (
                      <span className="text-slate-300">—</span>
                    )}
                  </td>

                  <td className="px-3 py-2.5 align-middle">
                    <span
                      className={cn(
                        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold",
                        status.className,
                      )}
                    >
                      <StatusIcon kind={status.icon} />
                      {status.text}
                    </span>
                    {row.audit && !row.audit.valid && expected != null && expected > 0 && (
                      <p className="text-[10px] text-red-600 mt-0.5 max-w-[140px] leading-tight">
                        Esperado {formatMoney(expected)}
                      </p>
                    )}
                  </td>

                  <td className="px-3 py-2.5 align-middle whitespace-nowrap">
                    {readAmount != null && readAmount > 0 ? (
                      <span
                        className={cn(
                          "font-semibold tabular-nums",
                          row.audit?.valid
                            ? "text-emerald-800"
                            : row.needsReview
                              ? "text-amber-900"
                              : "text-slate-700",
                        )}
                      >
                        {formatMoney(readAmount, row.audit?.currency)}
                      </span>
                    ) : (
                      <span className="text-slate-300">—</span>
                    )}
                  </td>

                  <td className="px-3 py-2.5 align-middle">
                    {doc ? (
                      <a
                        href={doc.downloadUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-[11px] font-medium text-brand hover:underline max-w-[120px] truncate"
                        title={doc.fileName}
                      >
                        <FileText className="h-3.5 w-3.5 shrink-0" />
                        Ver
                        <ExternalLink className="h-2.5 w-2.5 opacity-50" />
                      </a>
                    ) : (
                      <span className="text-slate-300 text-xs">—</span>
                    )}
                  </td>

                  <td className="px-3 py-2.5 align-middle text-right whitespace-nowrap">
                    {row.needsReview ? (
                      <div className="inline-flex gap-1">
                        <Button
                          size="sm"
                          className="h-7 px-2 text-[11px] bg-emerald-600 hover:bg-emerald-700"
                          disabled={actingId === row.id}
                          onClick={() => void handleConfirm(row.id)}
                        >
                          {actingId === row.id ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            "Aprobar"
                          )}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 px-2 text-[11px] border-red-200 text-red-700"
                          disabled={actingId === row.id}
                          onClick={() => void handleReject(row.id)}
                        >
                          Rechazar
                        </Button>
                      </div>
                    ) : (
                      <span className="text-[11px] text-slate-400">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
