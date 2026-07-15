"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Loader2,
  Wallet,
  CheckCircle,
  XCircle,
  FileText,
  Clock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { clinicApi } from "@/lib/clinic/client-api";
import type { PaymentReceiptAudit } from "@/lib/clinic/types";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { ReceiptValidationCard } from "@/components/patient/receipt-validation-card";
import { toast } from "sonner";

interface DoctorPaymentsLedgerProps {
  doctorId: string;
  /** Solo comprobantes que esperan aprobación del médico */
  pendingOnly?: boolean;
}

type LedgerEntry = {
  id: string;
  scheduledAt: string;
  patientName: string;
  paymentStatus?: string;
  audit?: PaymentReceiptAudit;
  needsReview?: boolean;
  documents?: Array<{ id: string; fileName: string; downloadUrl: string }>;
};

export function DoctorPaymentsLedger({
  doctorId,
  pendingOnly = false,
}: DoctorPaymentsLedgerProps) {
  const [loading, setLoading] = useState(true);
  const [entries, setEntries] = useState<LedgerEntry[]>([]);
  const [actingId, setActingId] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    clinicApi
      .getPaymentLedger(doctorId)
      .then((data) => setEntries(data.entries ?? []))
      .catch(() => setEntries([]))
      .finally(() => setLoading(false));
  }, [doctorId]);

  useEffect(() => {
    load();
    const interval = window.setInterval(load, 180_000);
    return () => window.clearInterval(interval);
  }, [load]);

  const handleConfirm = async (appointmentId: string) => {
    setActingId(appointmentId);
    try {
      await clinicApi.doctorConfirmPayment(appointmentId);
      toast.success("Pago aprobado — turno habilitado");
      load();
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
      toast.success("Pago rechazado — turno cancelado");
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al rechazar");
    } finally {
      setActingId(null);
    }
  };

  const visibleEntries = pendingOnly
    ? entries.filter((e) => e.needsReview)
    : entries;

  if (loading) {
    return (
      <div className="flex justify-center py-6">
        <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
      </div>
    );
  }

  if (visibleEntries.length === 0) {
    return (
      <p className="text-xs text-slate-500 rounded-lg border border-dashed p-4 text-center">
        {pendingOnly
          ? "No hay comprobantes pendientes de revisión."
          : "Todavía no hay comprobantes. Aparecen acá cuando un paciente reserva con transferencia o Mercado Pago."}
      </p>
    );
  }

  const pendingCount = visibleEntries.filter((e) => e.needsReview).length;
  const totalRead = visibleEntries.reduce(
    (sum, e) => sum + (e.audit?.amount ?? 0),
    0,
  );

  return (
    <div className="space-y-3">
      <div className="rounded-lg border bg-slate-50 p-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
          <Wallet className="h-4 w-4 text-emerald-600" />
          Comprobantes y cobros
        </div>
        <div className="flex items-center gap-2">
          {pendingCount > 0 && (
            <Badge className="bg-amber-600">
              {pendingCount} pendiente{pendingCount > 1 ? "s" : ""}
            </Badge>
          )}
          <span className="text-sm font-semibold text-emerald-800">
            {totalRead > 0
              ? `ARS ${totalRead.toLocaleString("es-AR")} leídos`
              : `${visibleEntries.length} turno(s)`}
          </span>
        </div>
      </div>

      <ul className="space-y-2 max-h-[32rem] overflow-y-auto">
        {visibleEntries.map((entry) => (
          <li
            key={entry.id}
            className={`rounded-lg border p-3 space-y-2 text-xs ${
              entry.needsReview
                ? "border-amber-300 bg-amber-50/40"
                : "bg-white"
            }`}
          >
            <div className="flex flex-wrap justify-between gap-2 items-start">
              <div>
                <span className="font-medium text-slate-800">
                  {entry.patientName}
                </span>
                <p className="text-slate-400 mt-0.5">
                  {format(new Date(entry.scheduledAt), "dd/MM/yyyy HH:mm", {
                    locale: es,
                  })}
                </p>
              </div>
              {entry.needsReview ? (
                <Badge
                  variant="outline"
                  className="border-amber-500 text-amber-800 shrink-0"
                >
                  <Clock className="h-3 w-3 mr-1" />
                  Esperando tu OK
                </Badge>
              ) : (
                <Badge className="bg-emerald-600 shrink-0">Confirmado</Badge>
              )}
            </div>

            {entry.audit ? (
              <ReceiptValidationCard audit={entry.audit} title="Detalle leído" />
            ) : (
              <p className="text-slate-500">Pago confirmado sin detalle IA</p>
            )}

            {entry.documents?.map((doc) => (
              <a
                key={doc.id}
                href={doc.downloadUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-blue-700 hover:underline"
              >
                <FileText className="h-3.5 w-3.5 shrink-0" />
                Ver comprobante: {doc.fileName}
              </a>
            ))}

            {entry.needsReview && (
              <div className="flex flex-wrap gap-2 pt-1">
                <Button
                  size="sm"
                  className="bg-emerald-600 hover:bg-emerald-700 h-8 text-xs"
                  disabled={actingId === entry.id}
                  onClick={() => void handleConfirm(entry.id)}
                >
                  {actingId === entry.id ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <>
                      <CheckCircle className="h-3.5 w-3.5 mr-1" />
                      Aprobar pago
                    </>
                  )}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 text-xs border-red-200 text-red-700 hover:bg-red-50"
                  disabled={actingId === entry.id}
                  onClick={() => void handleReject(entry.id)}
                >
                  <XCircle className="h-3.5 w-3.5 mr-1" />
                  Rechazar
                </Button>
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
