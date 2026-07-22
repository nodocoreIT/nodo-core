"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Check,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  FileText,
  Loader2,
  MessageCircle,
  Receipt,
  Trash2,
  X,
  XCircle,
  Clock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogHeader,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { RefundAppointmentModal } from "@/components/dashboard/refund-appointment-modal";
import type { PendingRefundItem } from "@/components/dashboard/day-appointments-panel";
import { clinicApi } from "@/lib/clinic/client-api";
import { currencySymbol } from "@/lib/clinic/currency";
import type { PaymentReceiptAudit } from "@/lib/clinic/local-db";
import { format, isToday } from "date-fns";
import { es } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface DoctorCobrosListProps {
  doctorId: string;
  onPendingChange?: () => void;
}

type CobroRow = {
  id: string;
  status?: string;
  patientName: string;
  patientPhone?: string;
  scheduledAt: string;
  createdAt?: string;
  paymentStatus?: string;
  paymentProvider?: "transfer" | "mercadopago";
  audit?: PaymentReceiptAudit;
  needsReview?: boolean;
  documents?: Array<{ id: string; fileName: string; downloadUrl: string }>;
};

function buildWhatsAppUrl(phone: string, message: string): string {
  const digits = phone.replace(/\D/g, "");
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}

type RowStatus = "pending" | "approved" | "rejected" | "other";

const PAGE_SIZE = 10;

const STATUS_FILTERS: { value: "all" | RowStatus; label: string }[] = [
  { value: "all", label: "Todos" },
  { value: "pending", label: "Pendientes" },
  { value: "approved", label: "Aprobados" },
  { value: "rejected", label: "Rechazados" },
];

function rowStatus(row: CobroRow): RowStatus {
  if (row.needsReview) return "pending";
  if (row.status === "cancelled" && row.audit) return "rejected";
  if (row.audit?.valid || row.paymentStatus === "confirmed") return "approved";
  if (row.audit && !row.audit.valid) return "rejected";
  return "other";
}

function formatMoney(amount: number, currency?: string) {
  return `${currencySymbol(currency)} ${amount.toLocaleString("es-AR")}`;
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
  if (rowStatus(row) === "rejected") {
    return {
      text: "Rechazado",
      className: "bg-red-100 text-red-800 border-red-200",
      icon: "bad",
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

function rowAmount(row: CobroRow): number | undefined {
  return row.audit?.amount ?? row.audit?.expectedAmount;
}

function monthKeyOf(row: CobroRow): string | null {
  const raw = row.createdAt ?? row.scheduledAt;
  if (!raw) return null;
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return null;
  return format(d, "yyyy-MM");
}

function monthLabel(key: string): string {
  const [y, m] = key.split("-");
  const d = new Date(Number(y), Number(m) - 1, 1);
  return d.toLocaleDateString("es-AR", { month: "long", year: "numeric" });
}

export function DoctorCobrosList({
  doctorId,
  onPendingChange,
}: DoctorCobrosListProps) {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<CobroRow[]>([]);
  const [actingId, setActingId] = useState<string | null>(null);
  const [rejectTarget, setRejectTarget] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [pendingRefunds, setPendingRefunds] = useState<PendingRefundItem[]>([]);
  const [refundModalOpen, setRefundModalOpen] = useState(false);
  const [viewDoc, setViewDoc] = useState<{ downloadUrl: string; fileName: string } | null>(null);
  const [statusFilter, setStatusFilter] = useState<"all" | RowStatus>("all");
  const [monthFilter, setMonthFilter] = useState<string>("all");
  const [page, setPage] = useState(0);

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
    const interval = window.setInterval(load, 180_000);
    return () => window.clearInterval(interval);
  }, [load]);


  const availableMonths = useMemo(() => {
    const set = new Set<string>();
    for (const row of rows) {
      const key = monthKeyOf(row);
      if (key) set.add(key);
    }
    return Array.from(set).sort().reverse();
  }, [rows]);

  const filteredRows = useMemo(() => {
    return rows.filter((row) => {
      if (statusFilter !== "all" && rowStatus(row) !== statusFilter) return false;
      if (monthFilter !== "all" && monthKeyOf(row) !== monthFilter) return false;
      return true;
    });
  }, [rows, statusFilter, monthFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE));
  const pagedRows = filteredRows.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const rejectRow = rows.find((r) => r.id === rejectTarget);

  // El total aprobado siempre respeta el filtro de mes (para poder ver "cuánto
  // ingresó este mes"), pero no el filtro de estado — si no, filtrar por
  // "Pendientes" haría que el total muestre $0, que no tiene sentido: el
  // objetivo es siempre ver el dinero real que entró, sin importar qué
  // subconjunto de filas se esté mirando en la tabla.
  const { todayTotal, approvedTotal } = useMemo(() => {
    let today = 0;
    let approved = 0;
    for (const row of rows) {
      if (monthFilter !== "all" && monthKeyOf(row) !== monthFilter) continue;
      if (rowStatus(row) !== "approved") continue;
      const amt = rowAmount(row) ?? 0;
      if (amt <= 0) continue;
      approved += amt;
      const refDate = row.createdAt ? new Date(row.createdAt) : new Date(row.scheduledAt);
      if (!Number.isNaN(refDate.getTime()) && isToday(refDate)) {
        today += amt;
      }
    }
    return { todayTotal: today, approvedTotal: approved };
  }, [rows, monthFilter]);

  const handleConfirm = async (appointmentId: string) => {
    setActingId(appointmentId);
    try {
      await clinicApi.doctorConfirmPayment(appointmentId);
      load();
      onPendingChange?.();
      window.dispatchEvent(new CustomEvent("cobros-notifications-read"));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al confirmar");
    } finally {
      setActingId(null);
    }
  };

  const handleReject = async () => {
    if (!rejectTarget) return;
    const appointmentId = rejectTarget;
    const row = rows.find((r) => r.id === appointmentId);
    setActingId(appointmentId);
    try {
      const result = await clinicApi.doctorRejectPayment(
        appointmentId,
        rejectReason.trim() || undefined,
      );
      load();
      onPendingChange?.();
      window.dispatchEvent(new CustomEvent("cobros-notifications-read"));
      if (result.requiresRefund) {
        setPendingRefunds([
          {
            appointmentId,
            patientName: row?.patientName ?? "Paciente",
            paymentProvider: result.paymentProvider === "mercadopago" ? "mercadopago" : "transfer",
          },
        ]);
        setRefundModalOpen(true);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al rechazar");
    } finally {
      setActingId(null);
      setRejectTarget(null);
      setRejectReason("");
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    const appointmentId = deleteTarget;
    const row = rows.find((r) => r.id === appointmentId);
    setActingId(appointmentId);
    try {
      if (row?.status === "cancelled") {
        // Ya está cancelado (ej. un pago rechazado) — no hay nada que
        // cancelar de nuevo, solo sacar la fila del historial.
        await clinicApi.doctorDeleteAppointment(appointmentId);
        load();
        onPendingChange?.();
        return;
      }

      const { results } = await clinicApi.doctorCancelAppointments([appointmentId]);
      const result = results[0];
      if (!result?.ok) return;
      load();
      onPendingChange?.();
      if (result.requiresRefund) {
        setPendingRefunds([
          {
            appointmentId,
            patientName: row?.patientName ?? "Paciente",
            paymentProvider: result.paymentProvider === "mercadopago" ? "mercadopago" : "transfer",
          },
        ]);
        setRefundModalOpen(true);
      }
    } catch (err) {
      console.error("[doctor-cobros-list] delete failed", err);
    } finally {
      setActingId(null);
      setDeleteTarget(null);
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
      {todayTotal > 0 && (
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <span className="text-slate-600">
            Hoy:{" "}
            <strong className="text-emerald-800">{formatMoney(todayTotal)}</strong>
          </span>
        </div>
      )}

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap gap-1.5">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.value}
              type="button"
              onClick={() => {
                setStatusFilter(f.value);
                setPage(0);
              }}
              className={cn(
                "rounded-full px-3 py-1 text-xs font-medium transition-colors border",
                statusFilter === f.value
                  ? "bg-navy text-white border-navy"
                  : "bg-white text-slate-600 border-mist hover:bg-slate-50",
              )}
            >
              {f.label}
            </button>
          ))}
        </div>

        {availableMonths.length > 0 && (
          <select
            value={monthFilter}
            onChange={(e) => {
              setMonthFilter(e.target.value);
              setPage(0);
            }}
            className="h-8 rounded-full border border-mist bg-white px-3 text-xs text-slate-600 capitalize"
          >
            <option value="all">Todos los meses</option>
            {availableMonths.map((key) => (
              <option key={key} value={key} className="capitalize">
                {monthLabel(key)}
              </option>
            ))}
          </select>
        )}
      </div>

      {filteredRows.length === 0 ? (
        <p className="text-sm text-slate-500 rounded-lg border border-dashed p-6 text-center">
          Sin resultados para este filtro.
        </p>
      ) : (
        <>
          <div className="overflow-x-auto rounded-lg border border-mist">
            <table className="w-full text-sm min-w-[820px]">
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
                    Nº operación
                  </th>
                  <th className="px-3 py-2 font-semibold whitespace-nowrap w-px">
                    Comprobante
                  </th>
                  <th className="px-3 py-2 font-semibold text-right whitespace-nowrap">
                    Acción
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-mist">
                {pagedRows.map((row) => {
                  const status = validationLabel(row);
                  const amount = rowAmount(row);
                  const doc = row.documents?.[0];
                  const receiptDate = row.createdAt
                    ? format(new Date(row.createdAt), "dd/MM/yyyy HH:mm", { locale: es })
                    : null;

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
                        {receiptDate ?? <span className="text-slate-300">—</span>}
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
                      </td>

                      <td className="px-3 py-2.5 align-middle whitespace-nowrap">
                        {amount != null && amount > 0 ? (
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
                            {formatMoney(amount, row.audit?.currency)}
                          </span>
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </td>

                      <td className="px-3 py-2.5 align-middle whitespace-nowrap">
                        {row.audit?.operationId ? (
                          <span className="font-mono text-[11px] text-slate-600" title={row.audit.operationId}>
                            {row.audit.operationId}
                          </span>
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </td>

                      <td className="px-3 py-2.5 align-middle whitespace-nowrap w-px">
                        {doc ? (
                          <button
                            type="button"
                            onClick={() => setViewDoc(doc)}
                            className="inline-flex items-center gap-1 text-[11px] font-medium text-brand hover:underline"
                            title="Comprobante"
                          >
                            <FileText className="h-3.5 w-3.5 shrink-0" />
                            Ver
                          </button>
                        ) : (
                          <span className="text-slate-300 text-xs">—</span>
                        )}
                      </td>

                      <td className="px-3 py-2.5 align-middle text-right whitespace-nowrap">
                        {row.needsReview ? (
                          <div className="inline-flex gap-1">
                            <Button
                              size="sm"
                              className="h-7 px-2 text-[11px] gap-1 bg-emerald-600 hover:bg-emerald-700"
                              disabled={actingId === row.id}
                              onClick={() => void handleConfirm(row.id)}
                            >
                              {actingId === row.id ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                <>
                                  <Check className="h-3 w-3" />
                                  Aprobar
                                </>
                              )}
                            </Button>
                            <Button
                              size="sm"
                              className="h-7 px-2 text-[11px] gap-1 bg-red-600 text-white hover:bg-red-700"
                              disabled={actingId === row.id}
                              onClick={() => setRejectTarget(row.id)}
                            >
                              <X className="h-3 w-3" />
                              Rechazar
                            </Button>
                          </div>
                        ) : (
                          <Button
                            size="sm"
                            variant="ghost"
                            aria-label="Eliminar turno"
                            title="Eliminar (cancela el turno)"
                            disabled={actingId === row.id}
                            onClick={() => setDeleteTarget(row.id)}
                            className="h-7 w-7 p-0 text-slate-400 hover:text-red-700 hover:bg-red-50"
                          >
                            {actingId === row.id ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Trash2 className="h-3.5 w-3.5" />
                            )}
                          </Button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Paginador */}
          {filteredRows.length > PAGE_SIZE && (
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span>
                Mostrando {page * PAGE_SIZE + 1}–
                {Math.min((page + 1) * PAGE_SIZE, filteredRows.length)} de{" "}
                {filteredRows.length}
              </span>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={page === 0}
                  onClick={() => setPage((p) => p - 1)}
                  aria-label="Página anterior"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="px-2 tabular-nums">
                  {page + 1} / {totalPages}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={page >= totalPages - 1}
                  onClick={() => setPage((p) => p + 1)}
                  aria-label="Página siguiente"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          {/* Total aprobados — dinero real que ingresó a la cuenta */}
          <div className="flex items-center justify-between rounded-lg border border-emerald-200 bg-emerald-50/60 px-4 py-3">
            <span className="text-sm font-medium text-emerald-900">
              Total de Ingresos del mes{monthFilter !== "all" ? ` · ${monthLabel(monthFilter)}` : ""}
            </span>
            <span className="text-lg font-bold text-emerald-800 tabular-nums">
              {formatMoney(approvedTotal)}
            </span>
          </div>
        </>
      )}

      <Dialog
        open={rejectTarget !== null}
        onOpenChange={(next) => {
          if (!next) {
            setRejectTarget(null);
            setRejectReason("");
          }
        }}
      >
        <DialogContent className="max-w-lg sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Rechazar comprobante</DialogTitle>
            <DialogDescription>
              Se cancelará el turno de {rejectRow?.patientName ?? "el paciente"}.
              {rejectRow?.paymentProvider === "mercadopago"
                ? " Si el pago ya estaba confirmado por Mercado Pago, vas a poder procesar el reembolso apenas rechaces."
                : " Si el paciente te transfirió, después de rechazar podés marcar la devolución manual."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <Label htmlFor="reject-reason" className="text-xs">
              Motivo del rechazo
            </Label>
            <Textarea
              id="reject-reason"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Ej: el comprobante no coincide con el monto del turno"
              rows={4}
            />
            <p className="text-[11px] text-slate-500">
              Se lo podés avisar al paciente por WhatsApp con el botón de abajo.
            </p>
          </div>

          <DialogFooter className="sm:justify-between">
            {rejectRow?.patientPhone && (
              <Button
                type="button"
                variant="outline"
                disabled={!rejectReason.trim()}
                onClick={() =>
                  window.open(
                    buildWhatsAppUrl(
                      rejectRow.patientPhone!,
                      `Hola ${rejectRow.patientName}, tu comprobante de pago para el turno del ${format(new Date(rejectRow.scheduledAt), "dd/MM 'a las' HH:mm", { locale: es })} fue rechazado. Motivo: ${rejectReason.trim()}`,
                    ),
                    "_blank",
                  )
                }
                className="gap-1.5"
              >
                <MessageCircle className="h-4 w-4" />
                Avisar por WhatsApp
              </Button>
            )}
            <Button
              type="button"
              className="bg-red-600 text-white hover:bg-red-700"
              disabled={actingId === rejectTarget}
              onClick={() => void handleReject()}
            >
              {actingId === rejectTarget ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Rechazar"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(next) => {
          if (!next) setDeleteTarget(null);
        }}
        title="Eliminar turno"
        description="Esto cancela el turno y lo saca de la agenda. Si tenía un pago confirmado, después vas a poder procesar la devolución."
        confirmLabel="Eliminar"
        destructive
        loading={actingId === deleteTarget}
        onConfirm={() => void handleDelete()}
      />

      <RefundAppointmentModal
        open={refundModalOpen}
        items={pendingRefunds}
        onClose={() => {
          setRefundModalOpen(false);
          setPendingRefunds([]);
        }}
      />

      <Dialog open={viewDoc !== null} onOpenChange={(open) => !open && setViewDoc(null)}>
        <DialogContent className="max-w-3xl sm:max-w-3xl max-h-[90vh] overflow-y-auto p-2 sm:p-4">
          <DialogTitle className="px-2 pt-1">Comprobante</DialogTitle>
          {viewDoc && (
            viewDoc.fileName.toLowerCase().endsWith(".pdf") ? (
              <iframe
                src={viewDoc.downloadUrl}
                title="Comprobante"
                className="h-[75vh] w-full rounded-md border"
              />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={viewDoc.downloadUrl}
                alt="Comprobante"
                className="max-h-[75vh] w-full rounded-md object-contain"
              />
            )
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
