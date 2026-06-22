"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { clinicApi } from "@/lib/clinic/client-api";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { ChevronRight, Loader2, Mail } from "lucide-react";
import { toast } from "sonner";

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
      doctor?: { fullName: string; specialty: string };
    }>
  >([]);
  const [resendingId, setResendingId] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const { user } = await clinicApi.getSession();
      if (!user?.id) return;
      const apts = await clinicApi.getPatientAppointments(user.id);
      setAppointments(Array.isArray(apts) ? apts : []);
      setLoading(false);
    }
    void load();
  }, []);

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

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
      </div>
    );
  }

  if (appointments.length === 0) {
    return (
      <p className="text-sm text-slate-400 text-center py-12">
        Todavía no tenés turnos registrados
      </p>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-2">
      {appointments.map((apt) => (
        <Card key={apt.id} className="border-slate-100">
          <CardContent className="py-3 flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-sm font-medium">Dr/a. {apt.doctor?.fullName}</p>
              <p className="text-xs text-slate-400">{apt.doctor?.specialty}</p>
              <p className="text-xs text-slate-500 mt-0.5">
                {format(new Date(apt.scheduledAt), "dd MMM yyyy · HH:mm 'hs'", {
                  locale: es,
                })}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs">
                {STATUS_LABEL[apt.status] ?? apt.status}
              </Badge>
              {["scheduled", "waiting", "in_consultation"].includes(
                apt.status,
              ) && (
                <>
                  <Link href={`/paciente/sala/${apt.accessToken}`}>
                    <Button size="sm" variant="outline" className="h-8 text-xs">
                      Sala
                      <ChevronRight className="h-3 w-3 ml-0.5" />
                    </Button>
                  </Link>
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
                </>
              )}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
