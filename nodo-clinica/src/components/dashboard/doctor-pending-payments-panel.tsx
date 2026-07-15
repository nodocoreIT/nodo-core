"use client";

import { useCallback, useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { clinicApi } from "@/lib/clinic/client-api";
import type { PaymentReceiptAudit } from "@/lib/clinic/types";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import {
  FileText,
  Loader2,
  CheckCircle,
  XCircle,
  Clock,
} from "lucide-react";
import { toast } from "sonner";
import { ReceiptValidationCard } from "@/components/patient/receipt-validation-card";

interface DoctorPendingPaymentsPanelProps {
  doctorId: string;
  onConfirmed?: () => void;
  /** En Cobros: mostrar sección aunque no haya pendientes */
  showEmpty?: boolean;
}

type PendingItem = {
  id: string;
  scheduledAt: string;
  paymentReceiptAudit?: PaymentReceiptAudit;
  patient?: { fullName: string; email?: string };
  documentCount?: number;
  documents?: Array<{ id: string; fileName: string; downloadUrl: string }>;
};

export function DoctorPendingPaymentsPanel({
  doctorId,
  onConfirmed,
  showEmpty = false,
}: DoctorPendingPaymentsPanelProps) {
  const [items, setItems] = useState<PendingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [actingId, setActingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const rows = await clinicApi.getPendingPaymentAppointments(doctorId);
      setItems(Array.isArray(rows) ? rows : []);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [doctorId]);

  useEffect(() => {
    void load();
    const interval = window.setInterval(() => void load(), 180_000);
    return () => window.clearInterval(interval);
  }, [load]);

  const handleConfirm = async (appointmentId: string) => {
    setActingId(appointmentId);
    try {
      await clinicApi.doctorConfirmPayment(appointmentId);
      toast.success("Pago aprobado — turno habilitado para el paciente");
      await load();
      onConfirmed?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al confirmar");
    } finally {
      setActingId(null);
    }
  };

  const handleReject = async (appointmentId: string) => {
    if (
      !window.confirm(
        "¿Rechazar este comprobante? Se cancelará el turno y el paciente deberá reservar de nuevo.",
      )
    ) {
      return;
    }
    setActingId(appointmentId);
    try {
      await clinicApi.doctorRejectPayment(appointmentId);
      toast.success("Pago rechazado — turno cancelado");
      await load();
      onConfirmed?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al rechazar");
    } finally {
      setActingId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-4">
        <Loader2 className="h-5 w-5 animate-spin text-amber-600" />
      </div>
    );
  }

  if (items.length === 0 && !showEmpty) return null;

  return (
    <Card className="border-amber-300 bg-amber-50/40 shadow-sm">
      <CardHeader className="py-3 px-4 border-b border-amber-200/80">
        <CardTitle className="text-sm flex items-center gap-2 text-amber-950">
          <Clock className="h-4 w-4" />
          Pagos pendientes de tu aprobación
          {items.length > 0 && (
            <Badge className="ml-auto bg-amber-600">{items.length}</Badge>
          )}
        </CardTitle>
        <p className="text-[11px] text-amber-900/80 mt-1 font-normal">
          El paciente ya subió comprobante pero la validación automática no fue
          concluyente. Aprobá para habilitar el turno o rechazá si no coincide.
        </p>
      </CardHeader>
      <CardContent className="px-4 py-4 space-y-3">
        {items.length === 0 ? (
          <p className="text-xs text-slate-500 text-center py-2">
            No hay pagos esperando revisión manual.
          </p>
        ) : (
          items.map((apt) => (
            <div
              key={apt.id}
              className="rounded-lg border border-amber-200 bg-white p-3 space-y-3"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-800">
                    {apt.patient?.fullName ?? "Paciente"}
                  </p>
                  <p className="text-xs text-slate-500">
                    Turno:{" "}
                    {format(new Date(apt.scheduledAt), "EEEE d MMM · HH:mm", {
                      locale: es,
                    })}
                  </p>
                </div>
                <Badge variant="outline" className="border-amber-400 text-amber-800">
                  Esperando OK
                </Badge>
              </div>

              {apt.paymentReceiptAudit && (
                <ReceiptValidationCard
                  audit={apt.paymentReceiptAudit}
                  title="Lectura del comprobante"
                />
              )}

              {apt.documents?.map((doc) => (
                <a
                  key={doc.id}
                  href={doc.downloadUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-xs text-blue-700 hover:underline"
                >
                  <FileText className="h-3.5 w-3.5 shrink-0" />
                  Ver comprobante: {doc.fileName}
                </a>
              ))}

              <div className="flex flex-wrap gap-2 pt-1">
                <Button
                  size="sm"
                  className="bg-emerald-600 hover:bg-emerald-700 h-8 text-xs"
                  disabled={actingId === apt.id}
                  onClick={() => void handleConfirm(apt.id)}
                >
                  {actingId === apt.id ? (
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
                  disabled={actingId === apt.id}
                  onClick={() => void handleReject(apt.id)}
                >
                  <XCircle className="h-3.5 w-3.5 mr-1" />
                  Rechazar
                </Button>
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
