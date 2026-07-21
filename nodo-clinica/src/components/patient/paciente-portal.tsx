"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Stethoscope,
  Calendar,
  LogOut,
  Loader2,
  Clock,
  ChevronRight,
  Camera,
  Mail,
} from "lucide-react";
import { toast } from "sonner";
import { BookAppointmentDialog } from "@/components/patient/book-appointment-dialog";
import { PatientHistorySection } from "@/components/patient/patient-history-section";
import { clinicApi } from "@/lib/clinic/client-api";
import type { PatientTimelineItem } from "@/lib/clinic/patient-timeline";
import { UserAvatar } from "@/components/ui/user-avatar";
import { format } from "date-fns";
import { es } from "date-fns/locale";

function readImageFile(file: File, maxKb = 400): Promise<string> {
  return new Promise((resolve, reject) => {
    if (file.size > maxKb * 1024) {
      reject(new Error(`Imagen muy grande (máx ${maxKb}KB)`));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

interface Doctor {
  id: string;
  fullName: string;
  specialty: string;
  licenseNumber: string;
  subscriptionPlan: string;
  profilePhotoUrl?: string;
  bio?: string;
  payment?: {
    consultationFee?: number;
    currency?: string;
    alias?: string;
    cbu?: string;
    bankName?: string;
    paymentInstructions?: string;
    qrImageData?: string;
    requirePaymentBeforeBooking?: boolean;
  };
}

interface Appointment {
  id: string;
  doctorId: string;
  scheduledAt: string;
  status: string;
  accessToken: string;
  paymentStatus?: string;
  paymentProvider?: "transfer" | "mercadopago";
  doctor?: Doctor;
}

export function PacientePortal() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [bookingDoctor, setBookingDoctor] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [resendingId, setResendingId] = useState<string | null>(null);
  const [patient, setPatient] = useState<{
    id: string;
    fullName: string;
    profilePhotoData?: string;
  } | null>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [timeline, setTimeline] = useState<PatientTimelineItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);

  useEffect(() => {
    async function init() {
      const { session, user } = await clinicApi.getSession();
      if (!session || !user?.id) {
        router.push("/login");
        setLoading(false);
        return;
      }
      if (session.role !== "patient") {
        // User has a privileged role (medico/admin) — send to doctor dashboard
        router.push("/medico/dashboard");
        setLoading(false);
        return;
      }

      try {
        setPatient({
          id: user.id,
          fullName: user.fullName,
          profilePhotoData: user.profilePhotoData,
        });
        const [docs, apts, history] = await Promise.all([
          clinicApi.getDoctors(),
          clinicApi.getPatientAppointments(user.id),
          clinicApi.getPatientHistory(user.id).catch(() => ({ timeline: [] })),
        ]);
        setDoctors(Array.isArray(docs) ? docs : []);
        setAppointments(Array.isArray(apts) ? apts : []);
        setTimeline(
          Array.isArray(history.timeline) ? history.timeline : [],
        );
      } catch (e) {
        toast.error("Error al cargar datos del portal");
        console.error(e);
      } finally {
        setLoading(false);
        setHistoryLoading(false);
      }
    }
    init();
  }, [router]);

  const handleBook = (doctorId: string, doctorName: string) => {
    setBookingDoctor({ id: doctorId, name: doctorName });
  };

  const handlePhotoChange = async (file: File) => {
    try {
      const profilePhotoData = await readImageFile(file);
      await clinicApi.updatePatientProfile({ profilePhotoData });
      setPatient((p) => (p ? { ...p, profilePhotoData } : p));
      toast.success("Foto de perfil actualizada");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error al subir foto");
    }
  };

  const handleLogout = async () => {
    await clinicApi.logout();
    window.location.href = "/";
  };

  const handleResendConfirmation = async (appointmentId: string) => {
    setResendingId(appointmentId);
    try {
      const result = await clinicApi.resendAppointmentConfirmation({
        appointmentId,
      });
      toast.success(result.message);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo enviar el email");
    } finally {
      setResendingId(null);
    }
  };

  const handleMercadoPagoCheckout = async (apt: {
    id: string;
    accessToken: string;
    paymentProvider?: string;
  }) => {
    setResendingId(apt.id);
    try {
      const result = await clinicApi.getMercadoPagoCheckout({
        appointmentId: apt.id,
        accessToken: apt.accessToken,
      });
      if (result.paid && result.waitingRoomUrl) {
        window.location.href = result.waitingRoomUrl;
        return;
      }
      if (result.checkoutUrl) {
        window.location.href = result.checkoutUrl;
        return;
      }
      toast.error("No se pudo abrir Mercado Pago");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error al pagar");
    } finally {
      setResendingId(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  const isConfirmedAppointment = (a: Appointment) =>
    !a.paymentStatus ||
    a.paymentStatus === "confirmed" ||
    a.paymentStatus === "waived";

  const activeAppointments = appointments.filter(
    (a) =>
      ["scheduled", "waiting", "in_consultation"].includes(a.status) &&
      isConfirmedAppointment(a)
  );

  const pendingPaymentAppointments = appointments.filter(
    (a) => a.paymentStatus === "pending" && a.status === "scheduled"
  );

  const hasActiveWithDoctor = (doctorId: string) =>
    activeAppointments.some((a) => a.doctorId === doctorId);

  const hasPendingPaymentWithDoctor = (doctorId: string) =>
    pendingPaymentAppointments.some((a) => a.doctorId === doctorId);

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-emerald-50/20">
      <header className="border-b bg-white/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-3xl mx-auto flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => photoInputRef.current?.click()}
              className="relative group"
              title="Cambiar foto de perfil"
            >
              <UserAvatar
                name={patient?.fullName || "Paciente"}
                photoUrl={patient?.profilePhotoData}
              />
              <span className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity">
                <Camera className="h-3.5 w-3.5 text-white" />
              </span>
            </button>
            <input
              ref={photoInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handlePhotoChange(file);
              }}
            />
            <div>
              <p className="text-sm font-semibold text-slate-800">
                Hola, {patient?.fullName}
              </p>
              <p className="text-xs text-slate-400">Portal del paciente</p>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={handleLogout}>
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6 space-y-6">
        {pendingPaymentAppointments.map((apt) => (
          <Card key={apt.id} className="border-amber-200 bg-amber-50/50">
            <CardContent className="pt-4">
              <Badge className="bg-amber-600 mb-2">Pago pendiente</Badge>
              <p className="font-medium text-slate-800">
                Dr/a. {apt.doctor?.fullName}
              </p>
              <p className="text-sm text-slate-500 mb-1">
                {format(new Date(apt.scheduledAt), "dd MMM yyyy · HH:mm 'hs'", {
                  locale: es,
                })}
              </p>
              <p className="text-sm text-slate-500 mb-3">
                {apt.paymentProvider === "mercadopago"
                  ? "Completá el pago con Mercado Pago para activar tu turno."
                  : "Confirmá la transferencia para activar tu turno."}
              </p>
              <div className="flex flex-wrap gap-2">
                {apt.paymentProvider === "mercadopago" && (
                  <Button
                    className="bg-[#009ee3] hover:bg-[#008ecf]"
                    disabled={resendingId === apt.id}
                    onClick={() => handleMercadoPagoCheckout(apt)}
                  >
                    {resendingId === apt.id ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-1" />
                    ) : null}
                    Pagar con Mercado Pago
                  </Button>
                )}
                <Link href={`/paciente/sala/${apt.accessToken}`}>
                  <Button
                    variant={
                      apt.paymentProvider === "mercadopago" ? "outline" : "default"
                    }
                    className={
                      apt.paymentProvider === "mercadopago"
                        ? ""
                        : "bg-amber-600 hover:bg-amber-700"
                    }
                  >
                    {apt.paymentProvider === "mercadopago"
                      ? "Ver sala"
                      : "Completar pago"}
                    <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        ))}

        {activeAppointments.map((apt) => (
          <Card key={apt.id} className="border-emerald-200 bg-emerald-50/50">
            <CardContent className="pt-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <Badge className="bg-emerald-600 mb-2">Turno activo</Badge>
                  <p className="font-medium text-slate-800">
                    Dr/a. {apt.doctor?.fullName}
                  </p>
                  <p className="text-sm text-slate-500">
                    {apt.doctor?.specialty}
                  </p>
                  <p className="text-xs text-slate-400 mt-1">
                    {format(new Date(apt.scheduledAt), "dd MMM yyyy · HH:mm 'hs'", {
                      locale: es,
                    })}
                  </p>
                </div>
                <div className="flex flex-col gap-2 shrink-0">
                  <Link href={`/paciente/sala/${apt.accessToken}`}>
                    <Button className="bg-emerald-600 hover:bg-emerald-700 w-full">
                      Ir a sala
                      <ChevronRight className="h-4 w-4 ml-1" />
                    </Button>
                  </Link>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-xs"
                    disabled={resendingId === apt.id}
                    onClick={() => handleResendConfirmation(apt.id)}
                  >
                    {resendingId === apt.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
                    ) : (
                      <Mail className="h-3.5 w-3.5 mr-1" />
                    )}
                    Reenviar email
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}

        <section>
          <h2 className="text-lg font-semibold text-slate-800 mb-3 flex items-center gap-2">
            <Stethoscope className="h-5 w-5 text-blue-600" />
            aaa
          </h2>
          <div className="space-y-3">
            {doctors.map((doc) => {
              const blocked =
                hasActiveWithDoctor(doc.id) || hasPendingPaymentWithDoctor(doc.id);
              return (
              <Card key={doc.id} className="border-slate-200">
                <CardContent className="pt-4">
                  <div className="flex items-center gap-3">
                    <UserAvatar
                      name={doc.fullName}
                      photoUrl={doc.profilePhotoUrl}
                      size="lg"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-slate-800">
                        {doc.fullName}
                      </p>
                      <p className="text-sm text-slate-500">{doc.specialty}</p>
                      {doc.payment?.consultationFee && (
                        <p className="text-xs text-emerald-700 mt-0.5">
                          Consulta: {doc.payment.currency ?? "ARS"} $
                          {doc.payment.consultationFee.toLocaleString("es-AR")}
                        </p>
                      )}
                      <Badge variant="outline" className="text-xs mt-1">
                        Mat. {doc.licenseNumber}
                      </Badge>
                      {blocked && (
                        <p className="text-[11px] text-slate-400 mt-1">
                          Ya tenés un turno con este médico
                        </p>
                      )}
                    </div>
                    <Button
                      onClick={() => handleBook(doc.id, doc.fullName)}
                      disabled={blocked}
                      className="bg-blue-700 hover:bg-blue-800 shrink-0"
                      size="sm"
                    >
                      <Calendar className="h-4 w-4 mr-1" />
                      Pedir turno
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
            })}
          </div>
        </section>

        {appointments.length > 0 && (
          <section>
            <h2 className="text-lg font-semibold text-slate-800 mb-3 flex items-center gap-2">
              <Clock className="h-5 w-5 text-slate-500" />
              Mis turnos
            </h2>
            <div className="space-y-2">
              {appointments.slice(0, 5).map((apt) => (
                <Card key={apt.id} className="border-slate-100">
                  <CardContent className="py-3 flex items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-medium">
                        Dr/a. {apt.doctor?.fullName}
                      </p>
                      <p className="text-xs text-slate-400">
                        {format(new Date(apt.scheduledAt), "dd MMM yyyy HH:mm", {
                          locale: es,
                        })}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Badge variant="outline" className="text-xs capitalize">
                        {apt.status.replace("_", " ")}
                      </Badge>
                      {["scheduled", "waiting", "in_consultation"].includes(
                        apt.status
                      ) && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 px-2"
                          title="Reenviar confirmación por email"
                          disabled={resendingId === apt.id}
                          onClick={() => handleResendConfirmation(apt.id)}
                        >
                          {resendingId === apt.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Mail className="h-3.5 w-3.5" />
                          )}
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>
        )}

        {patient && (
          <PatientHistorySection
            patientId={patient.id}
            timeline={timeline}
            loading={historyLoading}
          />
        )}
      </main>

      {bookingDoctor && (
        <BookAppointmentDialog
          doctorId={bookingDoctor.id}
          doctorName={bookingDoctor.name}
          payment={doctors.find((d) => d.id === bookingDoctor.id)?.payment}
          open={!!bookingDoctor}
          onOpenChange={(open) => !open && setBookingDoctor(null)}
        />
      )}
    </div>
  );
}
