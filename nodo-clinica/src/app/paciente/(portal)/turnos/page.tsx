"use client";

import { useCallback, useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { clinicApi } from "@/lib/clinic/client-api";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { ChevronRight, Loader2, Mail, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { WaitingRoomModal } from "@/components/patient/waiting-room-modal";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

const CANCELLABLE_STATUSES = ["scheduled"];
const ACTIVE_STATUSES = ["scheduled", "waiting", "in_consultation"];

const STATUS_LABEL: Record<string, string> = {
  scheduled: "Programado",
  waiting: "En espera",
  in_consultation: "En consulta",
  completed: "Finalizado",
  cancelled: "Cancelado",
};

export default function PacienteTurnosPage() {
  const [loading, setLoading] = useState(true);
  const [appointments, setAppointments] = useState<
    Array<{
      id: string;
      scheduledAt: string;
      status: string;
      accessToken: string;
      paymentStatus?: string;
      needsReview?: boolean;
      doctor?: { fullName: string; specialty: string };
    }>
  >([]);
  const [resendingId, setResendingId] = useState<string | null>(null);
  const [removingToken, setRemovingToken] = useState<string | null>(null);
  const [openToken, setOpenToken] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<
    { accessToken: string; status: string } | null
  >(null);

  const load = useCallback(async () => {
    const { user } = await clinicApi.getSession();
    if (!user?.id) return;
    const apts = await clinicApi.getPatientAppointments(user.id);
    setAppointments(Array.isArray(apts) ? apts : []);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handleResend = async (appointmentId: string) => {
    setResendingId(appointmentId);
    try {
      const result = await clinicApi.resendAppointmentConfirmation({
        appointmentId,
      });
      toast.success(result.message);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error al enviar");
    } finally {
      setResendingId(null);
    }
  };

  const handleRemove = async (accessToken: string, status: string) => {
    setRemovingToken(accessToken);
    try {
      if (status !== "cancelled") {
        await clinicApi.cancelPendingAppointment(accessToken);
      }
      await clinicApi.deleteCancelledAppointment(accessToken);
      toast.success("Turno eliminado");
      void load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo eliminar");
    } finally {
      setRemovingToken(null);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
      </div>
    );
  }

  return (
    <>
      {appointments.length === 0 ? (
        <p className="text-sm text-slate-400 text-center py-12">
          Todavía no tenés turnos registrados
        </p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {appointments.map((apt) => {
            const isActive = ACTIVE_STATUSES.includes(apt.status);
            const isPending = isActive && apt.paymentStatus === "pending";
            const isPendingReview = isPending && !!apt.needsReview;
            const isCancelled = apt.status === "cancelled";
            const badgeColor = isCancelled
              ? "bg-red-600"
              : isPending
                ? "bg-amber-600"
                : isActive
                  ? "bg-emerald-600"
                  : "bg-slate-400";

            return (
              <Card key={apt.id} className="border-slate-100">
                <CardContent className="py-3 space-y-2">
                  <Badge className={badgeColor}>
                    {isPendingReview
                      ? "En revisión"
                      : isPending
                        ? "Pago pendiente"
                        : STATUS_LABEL[apt.status] ?? apt.status}
                  </Badge>
                  <div>
                    <p className="text-sm font-medium">Dr/a. {apt.doctor?.fullName}</p>
                    <p className="text-xs text-slate-400">{apt.doctor?.specialty}</p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {format(new Date(apt.scheduledAt), "dd MMM yyyy · HH:mm 'hs'", {
                        locale: es,
                      })}
                    </p>
                  </div>
                  {isActive && (
                    <div className="flex items-center gap-2 pt-1">
                      {isPendingReview ? (
                        <p className="text-xs text-slate-500 flex-1">
                          Esperando aprobación del médico
                        </p>
                      ) : (
                        <Button
                          size="sm"
                          className={`h-8 text-xs flex-1 ${
                            isPending
                              ? "bg-amber-600 hover:bg-amber-700"
                              : "bg-emerald-600 hover:bg-emerald-700"
                          }`}
                          onClick={() => setOpenToken(apt.accessToken)}
                        >
                          {isPending ? "Completar pago" : "Ver turno"}
                          <ChevronRight className="h-3 w-3 ml-0.5" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 px-2"
                        disabled={resendingId === apt.id}
                        onClick={() => handleResend(apt.id)}
                      >
                        {resendingId === apt.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Mail className="h-3.5 w-3.5" />
                        )}
                      </Button>
                      {CANCELLABLE_STATUSES.includes(apt.status) && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 px-2 text-red-600 hover:text-red-700 hover:bg-red-50"
                          disabled={removingToken === apt.accessToken}
                          onClick={() =>
                            setConfirmAction({ accessToken: apt.accessToken, status: apt.status })
                          }
                        >
                          {removingToken === apt.accessToken ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Trash2 className="h-3.5 w-3.5" />
                          )}
                        </Button>
                      )}
                    </div>
                  )}
                  {isCancelled && (
                    <div className="flex items-center justify-end pt-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 px-2 text-red-600 hover:text-red-700 hover:bg-red-50"
                        disabled={removingToken === apt.accessToken}
                        onClick={() =>
                          setConfirmAction({ accessToken: apt.accessToken, status: apt.status })
                        }
                      >
                        {removingToken === apt.accessToken ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Trash2 className="h-3.5 w-3.5" />
                        )}
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <WaitingRoomModal
        accessToken={openToken}
        onOpenChange={(open) => {
          if (!open) {
            setOpenToken(null);
            void load();
          }
        }}
      />

      <ConfirmDialog
        open={!!confirmAction}
        onOpenChange={(open) => !open && setConfirmAction(null)}
        title="¿Eliminar este turno?"
        description="Se libera el horario y esta acción no se puede deshacer."
        confirmLabel="Eliminar"
        cancelLabel="Volver"
        loading={removingToken === confirmAction?.accessToken}
        onConfirm={async () => {
          if (!confirmAction) return;
          await handleRemove(confirmAction.accessToken, confirmAction.status);
          setConfirmAction(null);
        }}
      />
    </>
  );
}
