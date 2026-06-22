"use client";

import { useCallback, useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { clinicApi } from "@/lib/clinic/client-api";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { CreditCard, FileText, Loader2, CheckCircle } from "lucide-react";
import { toast } from "sonner";

interface DoctorPendingPaymentsPanelProps {
  doctorId: string;
  onConfirmed?: () => void;
}

export function DoctorPendingPaymentsPanel({
  doctorId,
  onConfirmed,
}: DoctorPendingPaymentsPanelProps) {
  const [items, setItems] = useState<
    Awaited<ReturnType<typeof clinicApi.getPendingPaymentAppointments>>
  >([]);
  const [loading, setLoading] = useState(true);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

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
    const interval = window.setInterval(() => void load(), 30_000);
    return () => window.clearInterval(interval);
  }, [load]);

  if (loading) return null;
  if (items.length === 0) return null;

  const handleConfirm = async (appointmentId: string) => {
    setConfirmingId(appointmentId);
    try {
      await clinicApi.doctorConfirmPayment(appointmentId);
      toast.success("Pago confirmado manualmente");
      await load();
      onConfirmed?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al confirmar");
    } finally {
      setConfirmingId(null);
    }
  };

  return (
    <Card className="border-amber-200 bg-amber-50/30">
      <CardHeader className="py-3 px-4">
        <CardTitle className="text-sm flex items-center gap-2 text-amber-900">
          <CreditCard className="h-4 w-4" />
          Pagos por revisar
          <Badge className="ml-auto bg-amber-600">{items.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-4 space-y-2">
        {items.map((apt) => (
          <div
            key={apt.id}
            className="rounded-lg border border-amber-100 bg-white p-3 flex flex-wrap items-center justify-between gap-2"
          >
            <div className="min-w-0">
              <p className="text-sm font-medium text-slate-800">
                {apt.patient?.fullName ?? "Paciente"}
              </p>
              <p className="text-xs text-slate-500">
                {format(new Date(apt.scheduledAt), "dd MMM yyyy HH:mm", {
                  locale: es,
                })}
                {(apt.documentCount ?? 0) > 0 && (
                  <span className="ml-2 inline-flex items-center gap-0.5">
                    <FileText className="h-3 w-3" />
                    {apt.documentCount} comprobante(s)
                  </span>
                )}
              </p>
              {apt.documents?.map((doc) => (
                <a
                  key={doc.id}
                  href={doc.downloadUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[11px] text-blue-600 hover:underline block truncate"
                >
                  {doc.fileName}
                </a>
              ))}
            </div>
            <Button
              size="sm"
              className="bg-emerald-600 hover:bg-emerald-700 h-8 text-xs shrink-0"
              disabled={confirmingId === apt.id}
              onClick={() => void handleConfirm(apt.id)}
            >
              {confirmingId === apt.id ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <>
                  <CheckCircle className="h-3.5 w-3.5 mr-1" />
                  Confirmar pago
                </>
              )}
            </Button>
          </div>
        ))}
        <p className="text-[10px] text-amber-800/80 pt-1">
          Usá esto si el paciente subió comprobante pero la validación automática falló.
        </p>
      </CardContent>
    </Card>
  );
}
