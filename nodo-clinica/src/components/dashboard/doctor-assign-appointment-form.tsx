"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  CalendarPlus,
  Check,
  Loader2,
  Mail,
  Search,
  User,
  X,
} from "lucide-react";
import { clinicApi } from "@/lib/clinic/client-api";
import { MonthCalendar, type CalendarDay } from "@/components/patient/month-calendar";
import {
  clinicTimeLabelFromIso,
  formatDateKeyLabel,
} from "@/lib/clinic/schedule";
import { UserAvatar } from "@/components/ui/user-avatar";
import { toast } from "sonner";

interface PatientOption {
  id: string;
  fullName: string;
  email: string;
  dni?: string | null;
  phone?: string;
  profilePhotoUrl?: string;
  profilePhotoData?: string;
}

export interface DoctorAssignAppointmentPrefill {
  patientId: string;
  patientName: string;
  patientEmail?: string;
  patientDni?: string | null;
  patientPhoto?: string;
}

interface DoctorAssignAppointmentFormProps {
  doctorId: string;
  active?: boolean;
  prefill?: DoctorAssignAppointmentPrefill | null;
  prefillMode?: "consultation" | "search";
  onAssigned?: () => void;
  onSuccessClose?: () => void;
}

export function DoctorAssignAppointmentForm({
  doctorId,
  active = true,
  prefill,
  prefillMode,
  onAssigned,
  onSuccessClose,
}: DoctorAssignAppointmentFormProps) {
  const [query, setQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchResults, setSearchResults] = useState<PatientOption[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<PatientOption | null>(
    null,
  );
  const [patientEmail, setPatientEmail] = useState("");
  const [intakeReason, setIntakeReason] = useState("");

  const [dates, setDates] = useState<CalendarDay[]>([]);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [slots, setSlots] = useState<
    { iso: string; label: string; status: "available" | "booked" }[]
  >([]);
  const [selectedSlots, setSelectedSlots] = useState<string[]>([]);
  const [loadingDates, setLoadingDates] = useState(false);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [assigning, setAssigning] = useState(false);

  const searchRef = useRef<HTMLDivElement>(null);

  const resetState = useCallback(() => {
    setQuery("");
    setSearchOpen(false);
    setSearchResults([]);
    setSelectedPatient(null);
    setPatientEmail("");
    setIntakeReason("");
    setSelectedDate(null);
    setSelectedSlots([]);
    setSlots([]);
  }, []);

  useEffect(() => {
    if (!active) {
      resetState();
      return;
    }

    if (prefill) {
      setSelectedPatient({
        id: prefill.patientId,
        fullName: prefill.patientName,
        email: prefill.patientEmail ?? "",
        dni: prefill.patientDni,
        profilePhotoUrl: prefill.patientPhoto,
        profilePhotoData: prefill.patientPhoto,
      });
      setPatientEmail(prefill.patientEmail ?? "");
    }

    setLoadingDates(true);
    clinicApi
      .getAvailableDates(doctorId)
      .then((data) => setDates(data.dates ?? []))
      .catch(() => toast.error("No se pudieron cargar los días disponibles"))
      .finally(() => setLoadingDates(false));
  }, [active, doctorId, prefill, resetState]);

  useEffect(() => {
    if (!active || prefill) return;
    if (!searchOpen) return;

    setSearchLoading(true);
    const timer = setTimeout(() => {
      clinicApi
        .searchPatients(doctorId, query)
        .then((data) =>
          setSearchResults(Array.isArray(data) ? (data as PatientOption[]) : []),
        )
        .finally(() => setSearchLoading(false));
    }, 250);

    return () => clearTimeout(timer);
  }, [active, doctorId, query, searchOpen, prefill]);

  useEffect(() => {
    if (!selectedDate) {
      setSlots([]);
      setSelectedSlots([]);
      return;
    }

    setLoadingSlots(true);
    clinicApi
      .getSlots(doctorId, selectedDate)
      .then((data) => setSlots(data.slots ?? []))
      .finally(() => setLoadingSlots(false));
  }, [selectedDate, doctorId]);

  useEffect(() => {
    const onPointerDown = (e: MouseEvent) => {
      if (!searchRef.current?.contains(e.target as Node)) {
        setSearchOpen(false);
      }
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, []);

  const availableSlots = useMemo(
    () => slots.filter((s) => s.status === "available"),
    [slots],
  );

  const selectedSlotLabels = useMemo(
    () =>
      selectedSlots.map((iso) => {
        const dateKey = iso.slice(0, 10);
        return `${formatDateKeyLabel(dateKey)} · ${clinicTimeLabelFromIso(iso)}`;
      }),
    [selectedSlots],
  );

  function selectPatient(patient: PatientOption) {
    setSelectedPatient(patient);
    setPatientEmail(patient.email ?? "");
    setSearchOpen(false);
    setQuery("");
  }

  function toggleSlot(iso: string) {
    setSelectedSlots((prev) =>
      prev.includes(iso) ? prev.filter((s) => s !== iso) : [...prev, iso],
    );
  }

  async function handleAssign() {
    if (!selectedPatient) {
      toast.error("Seleccioná un paciente");
      return;
    }
    if (!patientEmail.trim()) {
      toast.error("Ingresá el email del paciente");
      return;
    }
    if (selectedSlots.length === 0) {
      toast.error("Elegí al menos un horario");
      return;
    }

    setAssigning(true);
    try {
      const result = await clinicApi.doctorAssignAppointments({
        patientId: selectedPatient.id,
        patientEmail: patientEmail.trim(),
        scheduledAtList: selectedSlots,
        intakeReason: intakeReason.trim() || undefined,
      });

      toast.success(
        result.count === 1
          ? `Turno asignado. Se envió un email a ${result.patientEmail}.`
          : `${result.count} turnos asignados. Se envió un email por cada turno a ${result.patientEmail}.`,
      );

      if (onSuccessClose) {
        onSuccessClose();
      } else {
        resetState();
        setLoadingDates(true);
        clinicApi
          .getAvailableDates(doctorId)
          .then((data) => setDates(data.dates ?? []))
          .finally(() => setLoadingDates(false));
      }

      onAssigned?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al asignar turno");
    } finally {
      setAssigning(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <Label>Paciente</Label>
        {prefill && selectedPatient && prefillMode === "consultation" ? (
          <div className="flex items-center gap-3 rounded-lg border border-emerald-200 bg-emerald-50/60 p-3">
            <UserAvatar
              name={selectedPatient.fullName}
              photoUrl={
                selectedPatient.profilePhotoUrl ?? selectedPatient.profilePhotoData
              }
              size="sm"
            />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-slate-800 truncate">
                {selectedPatient.fullName}
              </p>
              {selectedPatient.dni && (
                <p className="text-xs text-slate-500">DNI {selectedPatient.dni}</p>
              )}
            </div>
            <Badge variant="outline" className="text-emerald-700 border-emerald-200">
              En consulta
            </Badge>
          </div>
        ) : selectedPatient ? (
          <div className="flex items-center gap-3 rounded-lg border border-slate-200 p-3">
            <UserAvatar
              name={selectedPatient.fullName}
              photoUrl={
                selectedPatient.profilePhotoUrl ?? selectedPatient.profilePhotoData
              }
              size="sm"
            />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-slate-800 truncate">
                {selectedPatient.fullName}
              </p>
              <p className="text-xs text-slate-500 truncate">
                {[selectedPatient.dni ? `DNI ${selectedPatient.dni}` : null, selectedPatient.email]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 px-2"
              onClick={() => {
                setSelectedPatient(null);
                setPatientEmail("");
              }}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          <div ref={searchRef} className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 z-10" />
            <Input
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setSearchOpen(true);
              }}
              onFocus={() => setSearchOpen(true)}
              placeholder="Buscar por nombre, DNI o email…"
              className="pl-9"
            />
            {searchOpen && (
              <div className="absolute top-full left-0 right-0 mt-1 z-50 rounded-lg border border-slate-200 bg-white shadow-lg max-h-56 overflow-y-auto">
                {searchLoading ? (
                  <div className="flex justify-center py-6">
                    <Loader2 className="h-5 w-5 animate-spin text-brand" />
                  </div>
                ) : searchResults.length === 0 ? (
                  <p className="text-sm text-slate-400 text-center py-6 px-4">
                    {query
                      ? "Sin resultados — probá con otro nombre o DNI"
                      : "Escribí para buscar pacientes inscriptos"}
                  </p>
                ) : (
                  <div className="p-1">
                    {searchResults.map((patient) => (
                      <button
                        key={patient.id}
                        type="button"
                        className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-left hover:bg-slate-50"
                        onClick={() => selectPatient(patient)}
                      >
                        <User className="h-4 w-4 text-slate-400 shrink-0" />
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-slate-800 truncate">
                            {patient.fullName}
                          </p>
                          <p className="text-xs text-slate-500 truncate">
                            {[patient.dni ? `DNI ${patient.dni}` : null, patient.email]
                              .filter(Boolean)
                              .join(" · ")}
                          </p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="assign-patient-email">Email de confirmación</Label>
        <div className="relative">
          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            id="assign-patient-email"
            type="email"
            value={patientEmail}
            onChange={(e) => setPatientEmail(e.target.value)}
            placeholder="correo@ejemplo.com"
            className="pl-9"
            disabled={!selectedPatient}
          />
        </div>
        <p className="text-xs text-slate-500">
          El paciente recibirá un email para ingresar y completar el pago del turno.
        </p>
      </div>

      <div className="space-y-2">
        <Label>Fecha y horarios</Label>
        {loadingDates ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-brand" />
          </div>
        ) : (
          <MonthCalendar
            days={dates}
            selectedDate={selectedDate}
            onSelectDate={setSelectedDate}
          />
        )}

        {selectedDate && (
          <div className="space-y-2 pt-2">
            <p className="text-sm font-medium text-slate-700">
              Horarios — {formatDateKeyLabel(selectedDate)}
            </p>
            {loadingSlots ? (
              <div className="flex justify-center py-4">
                <Loader2 className="h-5 w-5 animate-spin text-brand" />
              </div>
            ) : availableSlots.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-4">
                No hay horarios libres este día
              </p>
            ) : (
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                {availableSlots.map((slot) => {
                  const picked = selectedSlots.includes(slot.iso);
                  return (
                    <button
                      key={slot.iso}
                      type="button"
                      onClick={() => toggleSlot(slot.iso)}
                      className={`rounded-lg border px-2 py-2 text-sm transition-colors ${
                        picked
                          ? "border-brand bg-brand/10 text-brand font-medium"
                          : "border-slate-200 hover:border-brand/40 hover:bg-slate-50"
                      }`}
                    >
                      <span className="flex items-center justify-center gap-1">
                        {picked && <Check className="h-3.5 w-3.5" />}
                        {slot.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
            <p className="text-xs text-slate-500">Podés seleccionar uno o más turnos.</p>
          </div>
        )}
      </div>

      {selectedSlotLabels.length > 0 && (
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 space-y-1">
          <p className="text-xs font-medium text-slate-600">
            {selectedSlotLabels.length} turno
            {selectedSlotLabels.length !== 1 ? "s" : ""} seleccionado
            {selectedSlotLabels.length !== 1 ? "s" : ""}
          </p>
          {selectedSlotLabels.map((label) => (
            <p key={label} className="text-sm text-slate-700">
              · {label}
            </p>
          ))}
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="assign-intake">Motivo (opcional)</Label>
        <Textarea
          id="assign-intake"
          value={intakeReason}
          onChange={(e) => setIntakeReason(e.target.value)}
          placeholder="Motivo de consulta o nota para el paciente…"
          rows={2}
        />
      </div>

      <Button
        type="button"
        className="w-full bg-brand hover:bg-brand/90"
        disabled={assigning || !selectedPatient || selectedSlots.length === 0}
        onClick={() => void handleAssign()}
      >
        {assigning ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <>
            <CalendarPlus className="h-4 w-4 mr-2" />
            Asignar{" "}
            {selectedSlots.length > 0
              ? `${selectedSlots.length} turno${selectedSlots.length !== 1 ? "s" : ""}`
              : "turno"}
          </>
        )}
      </Button>
    </div>
  );
}
