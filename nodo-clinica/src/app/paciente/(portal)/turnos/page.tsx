"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { clinicApi, getClientSession } from "@/lib/clinic/client-api";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { ChevronRight, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { WaitingRoomModal } from "@/components/patient/waiting-room-modal";
import { UserAvatar } from "@/components/ui/user-avatar";

const ACTIVE_STATUSES = ["scheduled", "waiting", "in_consultation"];

type PatientAppointment = {
  id: string;
  scheduledAt: string;
  status: string;
  accessToken: string;
  paymentStatus?: string;
  cancelledBy?: "patient" | "doctor" | null;
  paymentRejected?: boolean;
  needsReview?: boolean;
  doctor?: { fullName: string; specialty?: string; profilePhotoUrl?: string };
};

function appointmentBadgeLabel(apt: PatientAppointment): string {
  if (apt.status === "cancelled") {
    if (apt.paymentRejected) return "Rechazo";
    if (apt.cancelledBy === "doctor") return "Cancelado por el profesional";
    return "Cancelado";
  }
  if (ACTIVE_STATUSES.includes(apt.status) && apt.paymentStatus === "pending") {
    if (apt.needsReview) return "En revisión";
    return "Pago pendiente";
  }
  const labels: Record<string, string> = {
    scheduled: "Programado",
    waiting: "En espera",
    in_consultation: "En consulta",
    completed: "Finalizado",
    cancelled: "Cancelado",
  };
  return labels[apt.status] ?? apt.status;
}

function appointmentBadgeClass(apt: PatientAppointment): string {
  if (apt.status === "cancelled" || apt.paymentRejected) {
    return "bg-red-600";
  }
  if (ACTIVE_STATUSES.includes(apt.status) && apt.paymentStatus === "pending") {
    return apt.needsReview ? "bg-slate-500" : "bg-amber-600";
  }
  if (ACTIVE_STATUSES.includes(apt.status)) {
    return "bg-emerald-600";
  }
  return "bg-slate-400";
}

function PacienteTurnosContent() {
  const searchParams = useSearchParams();
  const tokenFromUrl = searchParams.get("token");

  const [loading, setLoading] = useState(true);
  const [appointments, setAppointments] = useState<PatientAppointment[]>([]);
  const [removingToken, setRemovingToken] = useState<string | null>(null);
  const [openToken, setOpenToken] = useState<string | null>(null);
  const [deepLinkHandled, setDeepLinkHandled] = useState(false);

  const load = useCallback(async () => {
    const stored = getClientSession();
    const storedPatientId =
      stored?.role === "patient" ? stored.userId : null;

    const sessionPromise = clinicApi.getSession();
    const appointmentsPromise = storedPatientId
      ? clinicApi.getPatientAppointments(storedPatientId)
      : null;

    const { user, session } = await sessionPromise;
    const patientAuthId =
      (session?.role === "patient" || stored?.role === "patient") &&
      (user?.id ?? stored?.userId)
        ? (user?.id ?? stored!.userId)
        : null;

    if (!patientAuthId) {
      setLoading(false);
      return;
    }

    const apts =
      appointmentsPromise && storedPatientId === patientAuthId
        ? await appointmentsPromise
        : await clinicApi.getPatientAppointments(patientAuthId);
    setAppointments(Array.isArray(apts) ? (apts as PatientAppointment[]) : []);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!tokenFromUrl || loading || deepLinkHandled) return;

    const match = appointments.find((a) => a.accessToken === tokenFromUrl);
    if (match) {
      setOpenToken(tokenFromUrl);
      setDeepLinkHandled(true);
      window.history.replaceState({}, "", "/paciente/turnos");
    }
  }, [tokenFromUrl, loading, appointments, deepLinkHandled]);

  const handleRemove = async (accessToken: string) => {
    setRemovingToken(accessToken);
    try {
      await clinicApi.removePatientAppointment(accessToken);
      setAppointments((prev) => prev.filter((a) => a.accessToken !== accessToken));
      toast.success("Turno eliminado");
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

            return (
              <Card key={apt.id} className="border-slate-100">
                <CardContent className="py-3 space-y-2">
                  <Badge className={appointmentBadgeClass(apt)}>
                    {appointmentBadgeLabel(apt)}
                  </Badge>
                  <div className="flex items-start gap-3">
                    <UserAvatar
                      name={apt.doctor?.fullName ?? "Profesional"}
                      photoUrl={apt.doctor?.profilePhotoUrl}
                      size="lg"
                      className="shrink-0"
                    />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-800">
                        {apt.doctor?.fullName
                          ? `Dr/a. ${apt.doctor.fullName}`
                          : "Profesional"}
                      </p>
                      {apt.doctor?.specialty ? (
                        <p className="text-xs text-slate-500">{apt.doctor.specialty}</p>
                      ) : null}
                      <p className="text-xs text-slate-500 mt-0.5">
                        {format(new Date(apt.scheduledAt), "dd MMM yyyy · HH:mm 'hs'", {
                          locale: es,
                        })}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 pt-1">
                    {isActive && isPendingReview ? (
                      <p className="text-xs text-slate-500 flex-1">
                        Esperando aprobación del médico
                      </p>
                    ) : isActive ? (
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
                    ) : (
                      <div className="flex-1" />
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 px-2 text-red-600 hover:text-red-700 hover:bg-red-50"
                      disabled={removingToken === apt.accessToken}
                      onClick={() => void handleRemove(apt.accessToken)}
                    >
                      {removingToken === apt.accessToken ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="h-3.5 w-3.5" />
                      )}
                    </Button>
                  </div>
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
    </>
  );
}

export default function PacienteTurnosPage() {
  return (
    <Suspense
      fallback={
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
        </div>
      }
    >
      <PacienteTurnosContent />
    </Suspense>
  );
}
