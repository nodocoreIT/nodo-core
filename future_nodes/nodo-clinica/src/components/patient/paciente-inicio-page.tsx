"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Calendar,
  Loader2,
  ChevronRight,
  Mail,
  Search,
} from "lucide-react";
import { toast } from "sonner";
import { BookAppointmentDialog } from "@/components/patient/book-appointment-dialog";
import { clinicApi, getClientSession } from "@/lib/clinic/client-api";
import { UserAvatar } from "@/components/ui/user-avatar";
import {
  SPECIALTY_FILTERS,
  doctorMatchesFilter,
} from "@/lib/clinic/specialty-filters";
import { format } from "date-fns";
import { es } from "date-fns/locale";

interface Doctor {
  id: string;
  fullName: string;
  specialty: string;
  licenseNumber: string;
  profilePhotoData?: string;
  payment?: {
    requirePaymentBeforeBooking?: boolean;
    mercadopagoEnabled?: boolean;
  };
}

import type { PaymentReceiptAudit } from "@/lib/clinic/local-db";

interface Appointment {
  id: string;
  doctorId: string;
  scheduledAt: string;
  status: string;
  accessToken: string;
  paymentStatus?: string;
  paymentProvider?: "transfer" | "mercadopago";
  paymentReceiptAudit?: PaymentReceiptAudit;
  doctor?: Doctor;
}

export function PacienteInicioPage() {
  const [loading, setLoading] = useState(true);
  const [bookingDoctor, setBookingDoctor] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [resendingId, setResendingId] = useState<string | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [patientId, setPatientId] = useState<string | null>(null);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [specialtyFilter, setSpecialtyFilter] = useState("all");

  useEffect(() => {
    async function load() {
      try {
        let resolvedPatientId: string | null = null;

        try {
          const { session, user } = await clinicApi.getSession();
          if (session?.role === "patient" && user?.id) {
            resolvedPatientId = user.id;
          }
        } catch {
          /* fallback sessionStorage */
        }

        if (!resolvedPatientId) {
          const stored = getClientSession();
          if (stored?.role === "patient") {
            resolvedPatientId = stored.userId;
          }
        }

        setPatientId(resolvedPatientId);

        const docs = await clinicApi.getDoctors();
        setDoctors(Array.isArray(docs) ? docs : []);

        if (resolvedPatientId) {
          const apts =
            await clinicApi.getPatientAppointments(resolvedPatientId);
          setAppointments(Array.isArray(apts) ? apts : []);
        }
      } catch (e) {
        toast.error("Error al cargar médicos");
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, []);

  const filteredDoctors = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return doctors.filter((doc) => {
      if (!doctorMatchesFilter(doc.specialty, specialtyFilter)) return false;
      if (!q) return true;
      return (
        doc.fullName.toLowerCase().includes(q) ||
        doc.specialty.toLowerCase().includes(q) ||
        doc.licenseNumber.toLowerCase().includes(q)
      );
    });
  }, [doctors, searchQuery, specialtyFilter]);

  const pendingPayment = appointments.filter(
    (a) => a.paymentStatus === "pending" && a.status === "scheduled",
  );
  const awaitingDoctorApproval = pendingPayment.filter(
    (a) => !!a.paymentReceiptAudit,
  );
  const needsPaymentUpload = pendingPayment.filter(
    (a) => !a.paymentReceiptAudit,
  );

  const handleCancelPending = async (apt: Appointment) => {
    if (
      !window.confirm(
        "¿Cancelar este turno y liberar el horario? Podrás pedir otro turno con el mismo médico.",
      )
    ) {
      return;
    }
    setCancellingId(apt.id);
    try {
      await clinicApi.cancelPendingAppointment(apt.accessToken);
      setAppointments((prev) => prev.filter((a) => a.id !== apt.id));
      toast.success("Turno cancelado. Ya podés reservar otro horario.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo cancelar");
    } finally {
      setCancellingId(null);
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
    <div className="max-w-4xl mx-auto space-y-6">
      {awaitingDoctorApproval.map((apt) => (
        <Card key={apt.id} className="border-amber-300 bg-amber-50/60">
          <CardContent className="pt-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <Badge className="bg-amber-600 mb-1">En revisión del médico</Badge>
              <p className="font-medium">Dr/a. {apt.doctor?.fullName}</p>
              <p className="text-xs text-slate-600 mt-1">
                Subiste el comprobante. El médico debe aprobar el pago para
                habilitar tu turno.
              </p>
              <p className="text-xs text-slate-500 mt-1">
                {format(new Date(apt.scheduledAt), "dd MMM yyyy · HH:mm 'hs'", {
                  locale: es,
                })}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link href={`/paciente/sala/${apt.accessToken}`}>
                <Button variant="outline" className="border-amber-400 text-amber-900">
                  Ver estado
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </Link>
              <Button
                variant="outline"
                className="border-red-200 text-red-700"
                disabled={cancellingId === apt.id}
                onClick={() => void handleCancelPending(apt)}
              >
                {cancellingId === apt.id ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "Cancelar turno"
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}

      {needsPaymentUpload.map((apt) => (
        <Card key={apt.id} className="border-amber-200 bg-amber-50/50">
          <CardContent className="pt-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <Badge className="bg-amber-600 mb-1">
                {apt.paymentProvider === "mercadopago"
                  ? "Pago con Mercado Pago pendiente"
                  : "Pago pendiente"}
              </Badge>
              <p className="font-medium">Dr/a. {apt.doctor?.fullName}</p>
              <p className="text-xs text-slate-500">
                {format(new Date(apt.scheduledAt), "dd MMM yyyy · HH:mm 'hs'", {
                  locale: es,
                })}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link href={`/paciente/sala/${apt.accessToken}`}>
                <Button className="bg-amber-600 hover:bg-amber-700">
                  Completar pago
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </Link>
              <Button
                variant="outline"
                className="border-red-200 text-red-700"
                disabled={cancellingId === apt.id}
                onClick={() => void handleCancelPending(apt)}
              >
                {cancellingId === apt.id ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "Cancelar turno"
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}

      {false && pendingPayment.map((apt) => (
        <Card key={apt.id} className="border-emerald-200 bg-emerald-50/40">
          <CardContent className="pt-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <Badge className="bg-emerald-600 mb-1">Turno activo</Badge>
              <p className="font-medium">Dr/a. {apt.doctor?.fullName}</p>
              <p className="text-xs text-slate-500">{apt.doctor?.specialty}</p>
            </div>
            <Link href={`/paciente/sala/${apt.accessToken}`}>
              <Button className="bg-emerald-600 hover:bg-emerald-700">
                Ir a sala
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </Link>
          </CardContent>
        </Card>
      ))}

      <section>
        <div className="flex flex-col sm:flex-row sm:items-end gap-3 mb-4">
          <div className="flex-1">
            <h2 className="text-lg font-semibold text-slate-800">Buscar médico</h2>
            <p className="text-xs text-slate-500">
              Filtrá por especialidad y pedí turno online
            </p>
          </div>
          <div className="relative w-full sm:max-w-xs">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Nombre o especialidad..."
              className="pl-9 h-9"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        <div className="flex flex-wrap gap-2 mb-4">
          {SPECIALTY_FILTERS.map((f) => (
            <Button
              key={f.id}
              size="sm"
              variant={specialtyFilter === f.id ? "default" : "outline"}
              className={
                specialtyFilter === f.id
                  ? "h-8 text-xs bg-emerald-700 hover:bg-emerald-800"
                  : "h-8 text-xs"
              }
              onClick={() => setSpecialtyFilter(f.id)}
            >
              {f.label}
            </Button>
          ))}
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          {filteredDoctors.length === 0 ? (
            <p className="text-sm text-slate-400 col-span-2 text-center py-8 bg-white rounded-xl border">
              {doctors.length === 0
                ? "No hay médicos disponibles en este momento. Recargá la página o contactá al consultorio."
                : "No hay médicos con ese criterio de búsqueda"}
            </p>
          ) : (
            filteredDoctors.map((doc) => (
                <Card
                  key={doc.id}
                  className="border-slate-200 hover:shadow-md transition-shadow"
                >
                  <CardContent className="pt-4 space-y-3">
                    <div className="flex items-start gap-3">
                      <UserAvatar
                        name={doc.fullName}
                        photoUrl={doc.profilePhotoData}
                        size="lg"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-slate-800">
                          {doc.fullName}
                        </p>
                        <p className="text-sm text-slate-500">{doc.specialty}</p>
                        <Badge variant="outline" className="text-xs mt-1">
                          Mat. {doc.licenseNumber}
                        </Badge>
                      </div>
                    </div>
                    <Button
                      onClick={() =>
                        setBookingDoctor({ id: doc.id, name: doc.fullName })
                      }
                      className="bg-emerald-700 hover:bg-emerald-800 w-full"
                      size="sm"
                    >
                      <Calendar className="h-4 w-4 mr-1" />
                      Pedir turno
                    </Button>
                  </CardContent>
                </Card>
              ))
          )}
        </div>
      </section>

      {bookingDoctor && (
        <BookAppointmentDialog
          doctorId={bookingDoctor.id}
          doctorName={bookingDoctor.name}
          open={!!bookingDoctor}
          onOpenChange={(open) => !open && setBookingDoctor(null)}
        />
      )}
    </div>
  );
}
