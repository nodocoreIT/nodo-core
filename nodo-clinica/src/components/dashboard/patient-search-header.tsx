"use client";

import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Search, Loader2, History, Paperclip, Eye, X, CalendarPlus } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { UserAvatar } from "@/components/ui/user-avatar";
import { clinicApi } from "@/lib/clinic/client-api";

interface PatientSearchResult {
  id: string;
  fullName: string;
  email: string;
  dni?: string | null;
  phone?: string;
  profilePhotoData?: string;
  profilePhotoUrl?: string;
  stats: {
    appointments: number;
    documents: number;
    clinicalRecords: number;
  };
  lastAppointment?: string;
}

interface PatientSearchHeaderProps {
  doctorId: string;
  onViewPatient: (patient: {
    patientId: string;
    patientName: string;
    patientEmail?: string;
    patientPhone?: string;
    patientPhoto?: string;
  }) => void;
  onAssignPatient?: (patient: {
    patientId: string;
    patientName: string;
    patientEmail?: string;
    patientDni?: string | null;
    patientPhoto?: string;
  }) => void;
}

export function PatientSearchHeader({
  doctorId,
  onViewPatient,
  onAssignPatient,
}: PatientSearchHeaderProps) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<PatientSearchResult[]>([]);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    const timer = setTimeout(() => {
      clinicApi
        .searchPatients(doctorId, query)
        .then((data) => setResults(Array.isArray(data) ? data : []))
        .finally(() => setLoading(false));
    }, 250);
    return () => clearTimeout(timer);
  }, [doctorId, query, open]);

  useEffect(() => {
    const onPointerDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, []);

  const handleView = (patient: PatientSearchResult) => {
    onViewPatient({
      patientId: patient.id,
      patientName: patient.fullName,
      patientEmail: patient.email,
      patientPhone: patient.phone,
      patientPhoto: patient.profilePhotoData,
    });
    setOpen(false);
    setQuery("");
  };

  return (
    <div ref={rootRef} className="relative hidden md:block w-56 lg:w-72">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 z-10" />
      <Input
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        placeholder="Buscar por nombre, DNI o email…"
        className="pl-9 pr-8 h-9 bg-slate-50 border-slate-200"
      />
      {query && (
        <button
          type="button"
          onClick={() => {
            setQuery("");
            setOpen(false);
          }}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
        >
          <X className="h-4 w-4" />
        </button>
      )}

      {open && (
        <div className="absolute top-full left-0 right-0 mt-1.5 z-50 rounded-lg border border-slate-200 bg-white shadow-lg max-h-[min(420px,70vh)] overflow-y-auto">
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
            </div>
          ) : results.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-8 px-4">
              {query ? "Sin resultados" : "Escribí nombre, DNI o email"}
            </p>
          ) : (
            <div className="p-2 space-y-1">
              {results.map((patient) => (
                <div
                  key={patient.id}
                  className="rounded-lg border border-slate-100 p-3 hover:bg-slate-50/80"
                >
                  <div className="flex items-start gap-3">
                    <UserAvatar
                      name={patient.fullName}
                      photoUrl={patient.profilePhotoData}
                      size="sm"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-800 truncate">
                        {patient.fullName}
                      </p>
                      <p className="text-xs text-slate-400 truncate">
                        {[patient.dni ? `DNI ${patient.dni}` : null, patient.email]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                      <div className="flex flex-wrap gap-1.5 mt-1.5">
                        {patient.stats.appointments > 0 && (
                          <Badge variant="outline" className="text-[10px] h-5">
                            {patient.stats.appointments} turno
                            {patient.stats.appointments !== 1 ? "s" : ""}
                          </Badge>
                        )}
                        {patient.lastAppointment && (
                          <Badge variant="outline" className="text-[10px] h-5">
                            Último:{" "}
                            {format(new Date(patient.lastAppointment), "dd MMM yyyy", {
                              locale: es,
                            })}
                          </Badge>
                        )}
                        {patient.stats.clinicalRecords > 0 && (
                          <Badge variant="outline" className="text-[10px] h-5">
                            <History className="h-3 w-3 mr-1" />
                            {patient.stats.clinicalRecords}
                          </Badge>
                        )}
                        {patient.stats.documents > 0 && (
                          <Badge
                            variant="outline"
                            className="text-[10px] h-5 border-amber-200"
                          >
                            <Paperclip className="h-3 w-3 mr-1" />
                            {patient.stats.documents}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2 mt-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1 h-8 text-xs"
                      onClick={() => handleView(patient)}
                    >
                      <Eye className="h-3.5 w-3.5 mr-1" />
                      Ver ficha
                    </Button>
                    {onAssignPatient && (
                      <Button
                        size="sm"
                        className="flex-1 h-8 text-xs bg-brand hover:bg-brand/90"
                        onClick={() => {
                          onAssignPatient({
                            patientId: patient.id,
                            patientName: patient.fullName,
                            patientEmail: patient.email,
                            patientDni: patient.dni,
                            patientPhoto:
                              patient.profilePhotoData ?? patient.profilePhotoUrl,
                          });
                          setOpen(false);
                          setQuery("");
                        }}
                      >
                        <CalendarPlus className="h-3.5 w-3.5 mr-1" />
                        Asignar turno
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
