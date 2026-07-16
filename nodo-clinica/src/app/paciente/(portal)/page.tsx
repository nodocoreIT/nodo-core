"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/ui/user-avatar";
import { BookAppointmentDialog } from "@/components/patient/book-appointment-dialog";
import { clinicApi } from "@/lib/clinic/client-api";
import { Stethoscope, Calendar, ChevronRight, Loader2, Mail } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { toast } from "sonner";

interface Doctor {
  id: string;
  fullName: string;
  specialty: string;
  licenseNumber: string;
  subscriptionPlan: string;
  profilePhotoData?: string;
  bio?: string;
  payment?: {
    consultationFee?: number;
    currency?: string;
    alias?: string;
    cbu?: string;
    requirePaymentBeforeBooking?: boolean;
    mercadopagoEnabled?: boolean;
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

export default function BuscarMedicoPage() {
  const [loading, setLoading] = useState(true);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [bookingDoctor, setBookingDoctor] = useState<{ id: string; name: string } | null>(null);
  const [resendingId, setResendingId] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const { user } = await clinicApi.getSession();
      if (!user?.id) return;
      const [docs, apts] = await Promise.all([
        clinicApi.getDoctors(),
        clinicApi.getPatientAppointments(user.id),
      ]);
      setDoctors(Array.isArray(docs) ? docs : []);
      setAppointments(Array.isArray(apts) ? apts : []);
      setLoading(false);
    }
    void load();
  }, []);

  const isConfirmed = (a: Appointment) =>
    !a.paymentStatus || a.paymentStatus === "confirmed" || a.paymentStatus === "waived";

  const activeAppointments = appointments.filter(
    (a) => ["scheduled", "waiting", "in_consultation"].includes(a.status) && isConfirmed(a),
  );

  const pendingPaymentAppointments = appointments.filter(
    (a) => a.paymentStatus === "pending" && a.status === "scheduled",
  );

  const hasActiveWithDoctor = (doctorId: string) =>
    activeAppointments.some((a) => a.doctorId === doctorId);

  const hasPendingPaymentWithDoctor = (doctorId: string) =>
    pendingPaymentAppointments.some((a) => a.doctorId === doctorId);

  const handleResend = async (appointmentId: string) => {
    setResendingId(appointmentId);
    try {
      const result = await clinicApi.resendAppointmentConfirmation({ appointmentId });
      toast.success(result.message);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo enviar el email");
    } finally {
      setResendingId(null);
    }
  };

  const handleMercadoPagoCheckout = async (apt: Appointment) => {
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
      <div className="flex justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl space-y-6">
      {/* Pending payment alerts */}
      {pendingPaymentAppointments.map((apt) => (
        <Card key={apt.id} className="border-amber-200 bg-amber-50/50">
          <CardContent className="pt-4">
            <Badge className="bg-amber-600 mb-2">Pago pendiente</Badge>
            <p className="font-medium text-slate-800">Dr/a. {apt.doctor?.fullName}</p>
            <p className="text-sm text-slate-500 mb-1">
              {format(new Date(apt.scheduledAt), "dd MMM yyyy · HH:mm 'hs'", { locale: es })}
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
                  {resendingId === apt.id ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
                  Pagar con Mercado Pago
                </Button>
              )}
              <Link href={`/paciente/sala/${apt.accessToken}`}>
                <Button
                  variant={apt.paymentProvider === "mercadopago" ? "outline" : "default"}
                  className={apt.paymentProvider !== "mercadopago" ? "bg-amber-600 hover:bg-amber-700" : ""}
                >
                  {apt.paymentProvider === "mercadopago" ? "Ver sala" : "Completar pago"}
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      ))}

      {/* Active appointment alerts */}
      {activeAppointments.map((apt) => (
        <Card key={apt.id} className="border-emerald-200 bg-emerald-50/50">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <Badge className="bg-emerald-600 mb-2">Turno activo</Badge>
                <p className="font-medium text-slate-800">Dr/a. {apt.doctor?.fullName}</p>
                <p className="text-sm text-slate-500">{apt.doctor?.specialty}</p>
                <p className="text-xs text-slate-400 mt-1">
                  {format(new Date(apt.scheduledAt), "dd MMM yyyy · HH:mm 'hs'", { locale: es })}
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
                  onClick={() => handleResend(apt.id)}
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

      {/* Doctors list */}
      <section>
        <h2 className="text-base font-semibold text-slate-700 mb-3 flex items-center gap-2">
          <Stethoscope className="h-4 w-4 text-emerald-600" />
          Médicos disponibles
        </h2>
        <div className="space-y-3">
          {doctors.map((doc) => {
            const blocked = hasActiveWithDoctor(doc.id) || hasPendingPaymentWithDoctor(doc.id);
            return (
              <Card key={doc.id} className="border-slate-200">
                <CardContent className="pt-4">
                  <div className="flex items-center gap-3">
                    <UserAvatar name={doc.fullName} photoUrl={doc.profilePhotoData} size="lg" />
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-slate-800">{doc.fullName}</p>
                      <p className="text-sm text-slate-500">{doc.specialty}</p>
                      {doc.payment?.consultationFee && (
                        <p className="text-xs text-emerald-700 mt-0.5">
                          Consulta: {doc.payment.currency ?? "ARS"} ${doc.payment.consultationFee.toLocaleString("es-AR")}
                        </p>
                      )}
                      <Badge variant="outline" className="text-xs mt-1">
                        Mat. {doc.licenseNumber}
                      </Badge>
                      {blocked && (
                        <p className="text-[11px] text-slate-400 mt-1">Ya tenés un turno con este médico</p>
                      )}
                    </div>
                    <Button
                      onClick={() => setBookingDoctor({ id: doc.id, name: doc.fullName })}
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

          {doctors.length === 0 && (
            <p className="text-sm text-slate-400 text-center py-8">
              No hay médicos disponibles en este momento.
            </p>
          )}
        </div>
      </section>

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
