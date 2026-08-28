"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar, Clock, Loader2 } from "lucide-react";
import { clinicApi, getClientSession } from "@/lib/clinic/client-api";
import { formatAppointmentLabelFromIso, isStaleActiveAppointment } from "@/lib/clinic/schedule";

interface Appointment {
  id: string;
  scheduledAt: string;
  status: string;
  paymentStatus?: string;
  doctor?: {
    fullName: string;
    specialty?: string;
    profilePhotoUrl?: string;
  };
}

export function SidebarUpcomingAppointments() {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const session = await clinicApi.getSession();
        if (!session?.user?.id) {
          setLoading(false);
          return;
        }
        const res = await clinicApi.getPatientAppointments(session.user.id);
        const upcoming = (res ?? [])
          .filter(
            (apt: Appointment) =>
              ["scheduled", "waiting", "in_consultation"].includes(apt.status) &&
              !isStaleActiveAppointment(apt.scheduledAt, apt.status),
          )
          .sort((a: Appointment, b: Appointment) =>
            new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime()
          )
          .slice(0, 3);
        setAppointments(upcoming);
      } catch (err) {
        console.error("Failed to load appointments:", err);
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, []);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Próximos turnos</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex justify-center py-8">
            <Loader2 className="h-4 w-4 animate-spin text-[var(--color-primary)]" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm flex items-center gap-2">
          <Calendar className="h-4 w-4" />
          Próximos turnos
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {appointments.length === 0 ? (
          <p className="text-xs text-slate-500">No tenés turnos programados.</p>
        ) : (
          appointments.map((apt) => (
            <div
              key={apt.id}
              className="flex flex-col gap-1 pb-3 border-b border-slate-100 last:border-0 last:pb-0"
            >
              <p className="font-medium text-sm text-slate-900">
                {apt.doctor?.fullName}
              </p>
              <p className="text-xs text-slate-500">
                {apt.doctor?.specialty}
              </p>
              <div className="flex items-center gap-1 text-xs text-slate-600">
                <Clock className="h-3 w-3" />
                {apt.scheduledAt
                  ? formatAppointmentLabelFromIso(apt.scheduledAt)
                  : "Horario no disponible"}
              </div>
              <div className="flex items-center gap-1">
                <span
                  className={`text-xs font-medium px-2 py-0.5 rounded ${
                    apt.paymentStatus === "confirmed"
                      ? "bg-emerald-100 text-emerald-700"
                      : apt.paymentStatus === "pending"
                        ? "bg-amber-100 text-amber-700"
                        : "bg-slate-100 text-slate-600"
                  }`}
                >
                  {apt.paymentStatus === "confirmed"
                    ? "Pago confirmado"
                    : apt.paymentStatus === "pending"
                      ? "Pago pendiente"
                      : "Gratuito"}
                </span>
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
