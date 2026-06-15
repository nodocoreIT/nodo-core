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
  Plus,
  UserCircle,
} from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { useAuth } from "@nodocore/shared-components";
import { supabase } from "@/shared/lib/supabase";
import { formatDateTime } from "@/shared/lib/utils";
import type { Appointment, Profile } from "@/types";
import { BookAppointmentDialog } from "@/features/paciente/book-appointment-dialog";

type AppointmentWithDoctor = Appointment & { doctor?: Profile };

interface DoctorCard {
  id: string;
  full_name: string;
  specialty?: string;
  photo_url?: string;
  consultation_fee?: number;
  currency?: string;
  alias?: string;
  cbu?: string;
  bank_name?: string;
  payment_instructions?: string;
  qr_image_url?: string;
  require_payment_before_booking?: boolean;
  mercadopago_enabled?: boolean;
}

export function PacienteHome() {
  const { session } = useAuth();
  const [appointments, setAppointments] = useState<AppointmentWithDoctor[]>([]);
  const [doctors, setDoctors] = useState<DoctorCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [bookTarget, setBookTarget] = useState<DoctorCard | null>(null);

  useEffect(() => {
    if (!session?.user.id) return;

    const fetchAll = async () => {
      const [{ data: apts, error: aptErr }, { data: docs }] = await Promise.all([
        supabase
          .from("appointments")
          .select(`
            *,
            patient:patients!inner(profile_id),
            doctor:profiles!doctor_id(full_name, specialty)
          `)
          .eq("patients.profile_id", session.user.id)
          .order("scheduled_at", { ascending: false })
          .limit(10),
        supabase
          .from("profiles")
          .select(
            "id, full_name, specialty, photo_url, consultation_fee, currency, alias, cbu, bank_name, payment_instructions, qr_image_url, require_payment_before_booking, mercadopago_enabled",
          )
          .eq("role", "doctor")
          .order("full_name"),
      ]);

      if (aptErr) toast.error("Error al cargar turnos");
      setAppointments((apts ?? []) as unknown as AppointmentWithDoctor[]);
      setDoctors((docs ?? []) as DoctorCard[]);
      setLoading(false);
    };

    void fetchAll();
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
            <p className="text-sm font-semibold text-navy">Nodo Clínica</p>
            <p className="text-xs text-slate2">Portal del Paciente</p>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6 space-y-8">
        {/* Active appointments */}
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

        {/* Book a new appointment */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-semibold text-navy flex items-center gap-2">
              <Stethoscope className="h-4 w-4 text-brand" />
              Médicos disponibles
            </h2>
          </div>

          {doctors.length === 0 ? (
            <p className="text-sm text-slate-400 py-4 text-center">
              No hay médicos disponibles en este momento.
            </p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {doctors.map((doc) => (
                <Card key={doc.id} className="border-slate-200 hover:border-brand/30 transition-colors">
                  <CardContent className="py-3 flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-brand/10 flex items-center justify-center shrink-0 overflow-hidden">
                      {doc.photo_url ? (
                        <img
                          src={doc.photo_url}
                          alt={doc.full_name}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <UserCircle className="h-5 w-5 text-brand" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-800 truncate">
                        Dr/a. {doc.full_name}
                      </p>
                      {doc.specialty && (
                        <p className="text-xs text-slate-400 truncate">{doc.specialty}</p>
                      )}
                      {doc.consultation_fee && (
                        <p className="text-xs text-brand font-semibold mt-0.5">
                          {doc.currency ?? "ARS"} {doc.consultation_fee.toLocaleString()}
                        </p>
                      )}
                    </div>
                    <Button
                      size="sm"
                      className="shrink-0 bg-brand hover:bg-brand-600"
                      onClick={() => setBookTarget(doc)}
                    >
                      <Plus className="h-3.5 w-3.5 mr-1" />
                      Turno
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </section>

        {/* Past appointments */}
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

        {appointments.length === 0 && doctors.length === 0 && (
          <div className="text-center py-12">
            <Stethoscope className="h-12 w-12 text-slate-200 mx-auto mb-4" />
            <p className="text-slate-500 font-medium">No tenés turnos registrados</p>
            <p className="text-sm text-slate-400 mt-1">
              Contactá a tu médico para agendar una consulta
            </p>
          </div>
        )}
      </main>

      {/* Book appointment dialog */}
      {bookTarget && (
        <BookAppointmentDialog
          doctorId={bookTarget.id}
          doctorName={bookTarget.full_name}
          payment={{
            consultationFee: bookTarget.consultation_fee,
            currency: bookTarget.currency,
            alias: bookTarget.alias,
            cbu: bookTarget.cbu,
            bankName: bookTarget.bank_name,
            paymentInstructions: bookTarget.payment_instructions,
            qrImageData: bookTarget.qr_image_url,
            requirePaymentBeforeBooking: bookTarget.require_payment_before_booking,
            mercadopagoEnabled: bookTarget.mercadopago_enabled,
          }}
          open={!!bookTarget}
          onOpenChange={(open) => { if (!open) setBookTarget(null); }}
        />
      )}
    </div>
  );
}
