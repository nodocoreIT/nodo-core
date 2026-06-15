import { useEffect, useState } from "react";
import {
  Card,
  CardContent,
  Button,
} from "@nodocore/shared-components";
import {
  Stethoscope,
  Calendar,
  Clock,
  ChevronRight,
  Loader2,
} from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { useAuth } from "@nodocore/shared-components";
import { supabase } from "@/shared/lib/supabase";
import { formatDateTime } from "@/shared/lib/utils";
import type { Appointment, Profile } from "@/types";

type AppointmentWithDoctor = Appointment & { doctor?: Profile };

export function PacienteHome() {
  const { session } = useAuth();
  const [appointments, setAppointments] = useState<AppointmentWithDoctor[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!session?.user.id) return;

    supabase
      .from("appointments")
      .select(`
        *,
        patient:patients!inner(profile_id),
        doctor:profiles!doctor_id(full_name, specialty)
      `)
      .eq("patients.profile_id", session.user.id)
      .order("scheduled_at", { ascending: false })
      .limit(10)
      .then(({ data, error }) => {
        if (error) toast.error("Error al cargar turnos");
        setAppointments((data ?? []) as unknown as AppointmentWithDoctor[]);
        setLoading(false);
      });
  }, [session?.user.id]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-brand" />
      </div>
    );
  }

  const activeAppointments = appointments.filter((a) =>
    ["scheduled", "waiting", "in_consultation"].includes(a.status),
  );
  const pastAppointments = appointments.filter((a) =>
    ["completed", "cancelled"].includes(a.status),
  );

  return (
    <div className="min-h-screen bg-paper">
      <header className="border-b bg-white/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-3xl mx-auto flex items-center gap-3 px-4 py-3">
          <div className="h-9 w-9 rounded-full bg-brand/10 flex items-center justify-center">
            <Stethoscope className="h-5 w-5 text-brand" />
          </div>
          <div>
            <p className="text-sm font-semibold text-navy">
              Nodo Clínica
            </p>
            <p className="text-xs text-slate2">Portal del Paciente</p>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6 space-y-6">
        {activeAppointments.length > 0 && (
          <section>
            <h2 className="text-base font-semibold text-navy mb-3 flex items-center gap-2">
              <Calendar className="h-4 w-4 text-brand" />
              Turnos activos
            </h2>
            <div className="space-y-3">
              {activeAppointments.map((apt) => (
                <Card key={apt.id} className="border-emerald-200 bg-emerald-50/50">
                  <CardContent className="pt-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="font-medium text-slate-800">
                          Dr/a. {(apt.doctor as Profile | undefined)?.full_name ?? "Médico"}
                        </p>
                        <p className="text-sm text-slate-500">
                          {(apt.doctor as Profile | undefined)?.specialty}
                        </p>
                        <p className="text-xs text-slate-400 mt-1">
                          {formatDateTime(apt.scheduled_at)}
                        </p>
                      </div>
                      <Link to={`/paciente/sala/${apt.access_token}`}>
                        <Button className="bg-emerald-600 hover:bg-emerald-700 shrink-0">
                          Ir a sala
                          <ChevronRight className="h-4 w-4 ml-1" />
                        </Button>
                      </Link>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>
        )}

        {pastAppointments.length > 0 && (
          <section>
            <h2 className="text-base font-semibold text-navy mb-3 flex items-center gap-2">
              <Clock className="h-4 w-4 text-slate2" />
              Historial de turnos
            </h2>
            <div className="space-y-2">
              {pastAppointments.map((apt) => (
                <Card key={apt.id} className="border-slate-100">
                  <CardContent className="py-3 flex items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-medium text-slate-800">
                        Dr/a. {(apt.doctor as Profile | undefined)?.full_name ?? "Médico"}
                      </p>
                      <p className="text-xs text-slate-400">
                        {formatDateTime(apt.scheduled_at)}
                      </p>
                    </div>
                    <span className="text-xs text-slate2 bg-mist px-2 py-0.5 rounded-full capitalize">
                      {apt.status.replace("_", " ")}
                    </span>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>
        )}

        {appointments.length === 0 && (
          <div className="text-center py-12">
            <Stethoscope className="h-12 w-12 text-slate-200 mx-auto mb-4" />
            <p className="text-slate-500 font-medium">
              No tenés turnos registrados
            </p>
            <p className="text-sm text-slate-400 mt-1">
              Contactá a tu médico para agendar una consulta
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
