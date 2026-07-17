"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Calendar,
  Loader2,
  Search,
  ChevronsUpDown,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { BookAppointmentDialog } from "@/components/patient/book-appointment-dialog";
import { WaitingRoomModal } from "@/components/patient/waiting-room-modal";
import { clinicApi } from "@/lib/clinic/client-api";
import { UserAvatar } from "@/components/ui/user-avatar";

// ── Specialty filter combobox (local data, no API) ─────────────────────────

const ALL_SPECIALTIES = [
  "Cardiología",
  "Clínica Médica",
  "Dermatología",
  "Endocrinología",
  "Gastroenterología",
  "Ginecología",
  "Infectología",
  "Medicina General",
  "Neurología",
  "Nutrición",
  "Oftalmología",
  "Ortopedia y Traumatología",
  "Otorrinolaringología",
  "Pediatría",
  "Psicología",
  "Psiquiatría",
  "Reumatología",
  "Urología",
];

function SpecialtyFilterCombobox({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? ALL_SPECIALTIES.filter((s) => s.toLowerCase().includes(q)) : ALL_SPECIALTIES;
  }, [query]);

  // Close on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery("");
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  function select(spec: string) {
    onChange(spec);
    setOpen(false);
    setQuery("");
  }

  function clear(e: React.MouseEvent) {
    e.stopPropagation();
    onChange("all");
    setOpen(false);
    setQuery("");
  }

  const label = value === "all" ? "Buscar por especialidad..." : value;
  const hasValue = value !== "all";

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => {
          setOpen((o) => !o);
          if (!open) setTimeout(() => inputRef.current?.focus(), 0);
        }}
        className="flex h-9 w-full items-center justify-between gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm transition-colors hover:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
      >
        <span className={hasValue ? "font-medium text-emerald-700" : "text-slate-400"}>
          {label}
        </span>
        {hasValue ? (
          <X className="h-3.5 w-3.5 shrink-0 text-slate-400 hover:text-slate-700" onClick={clear} />
        ) : (
          <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 text-slate-400" />
        )}
      </button>

      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 w-full min-w-[220px] rounded-md border border-slate-200 bg-white shadow-lg">
          <div className="border-b border-slate-100 p-2">
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar especialidad..."
              className="w-full rounded border-0 bg-slate-50 px-2.5 py-1.5 text-sm outline-none placeholder:text-slate-400"
            />
          </div>
          <ul className="max-h-56 overflow-y-auto py-1" role="listbox">
            <li
              role="option"
              aria-selected={value === "all"}
              onClick={() => select("all")}
              className="cursor-pointer px-3 py-1.5 text-sm text-slate-500 hover:bg-emerald-50 hover:text-emerald-700"
            >
              Todas las especialidades
            </li>
            {filtered.length === 0 && (
              <li className="px-3 py-2 text-xs text-slate-400">Sin resultados</li>
            )}
            {filtered.map((spec) => (
              <li
                key={spec}
                role="option"
                aria-selected={value === spec}
                onClick={() => select(spec)}
                className={`cursor-pointer px-3 py-1.5 text-sm hover:bg-emerald-50 hover:text-emerald-700 ${
                  value === spec ? "bg-emerald-50 font-medium text-emerald-700" : "text-slate-700"
                }`}
              >
                {spec}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

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


export function PacienteInicioPage() {
  const [loading, setLoading] = useState(true);
  const [bookingDoctor, setBookingDoctor] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [waitingRoomToken, setWaitingRoomToken] = useState<string | null>(null);
  const [pendingBookedMessage, setPendingBookedMessage] = useState<string | null>(null);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [specialtyFilter, setSpecialtyFilter] = useState("all");

  useEffect(() => {
    async function load() {
      try {
        const docs = await clinicApi.getDoctors();
        setDoctors(Array.isArray(docs) ? docs : []);
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
      if (specialtyFilter !== "all" && doc.specialty?.trim() !== specialtyFilter) return false;
      if (!q) return true;
      return (
        (doc.fullName ?? "").toLowerCase().includes(q) ||
        (doc.specialty ?? "").toLowerCase().includes(q) ||
        (doc.licenseNumber ?? "").toLowerCase().includes(q)
      );
    });
  }, [doctors, searchQuery, specialtyFilter]);

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <section>
        <div className="mb-3">
        
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Nombre del médico..."
                className="pl-9 pr-8 h-9"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-700"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
            <div className="flex-1">
              <SpecialtyFilterCombobox
                value={specialtyFilter}
                onChange={setSpecialtyFilter}
              />
            </div>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          {filteredDoctors.length === 0 ? (
            <p className="text-sm text-slate-400 col-span-2 text-center py-8 bg-white rounded-xl border">
              {doctors.length === 0
                ? "No hay médicos disponibles en este momento."
                : specialtyFilter !== "all"
                  ? `No hay médicos registrados en ${specialtyFilter} por el momento.`
                  : "No hay médicos con ese criterio de búsqueda."}
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
          onBooked={(accessToken, message) => {
            setPendingBookedMessage(message);
            setWaitingRoomToken(accessToken);
          }}
        />
      )}

      <WaitingRoomModal
        accessToken={waitingRoomToken}
        onOpenChange={(open) => !open && setWaitingRoomToken(null)}
        onReady={() => {
          if (pendingBookedMessage) {
            toast.success(pendingBookedMessage);
            setPendingBookedMessage(null);
          }
        }}
      />
    </div>
  );
}
