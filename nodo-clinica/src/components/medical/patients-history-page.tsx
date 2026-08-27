"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Search, ChevronRight, Users, Loader2, CalendarDays } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { clinicApi } from "@/lib/clinic/client-api";

interface PatientRow {
  id: string;
  fullName: string;
  profilePhotoUrl: string | null;
  lastVisit: string;
  visitCount: number;
}

function initials(value: string): string {
  const parts = value.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return value.trim().slice(0, 2).toUpperCase() || "?";
}

export function PatientsHistoryPage() {
  const [patients, setPatients] = useState<PatientRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  useEffect(() => {
    let active = true;
    clinicApi
      .getMyPatients()
      .then((data) => {
        if (active) setPatients(data.patients);
      })
      .catch((e) => {
        if (active) setError(e instanceof Error ? e.message : "Error al cargar pacientes");
      });
    return () => {
      active = false;
    };
  }, []);

  const filtered = useMemo(() => {
    if (!patients) return [];
    const q = query.trim().toLowerCase();
    if (!q) return patients;
    return patients.filter((p) => p.fullName.toLowerCase().includes(q));
  }, [patients, query]);

  if (error) {
    return (
      <div className="mx-auto max-w-3xl">
        <p className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</p>
      </div>
    );
  }

  if (!patients) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-[var(--color-primary)]" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-5">
        <h2 className="font-display text-xl font-bold text-navy">Mis pacientes</h2>
        <p className="text-sm text-slate2">
          Pacientes que atendiste. Entrá para ver su historia clínica y las consultas anteriores.
        </p>
      </div>

      <div className="relative mb-4">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate2" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar por nombre…"
          className="w-full rounded-md border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-[15px] outline-none transition-all focus:border-[var(--color-primary)] focus:shadow-[0_0_0_4px_rgba(13,148,136,.16)]"
        />
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-slate-200 bg-white py-16 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-teal-50 text-teal-700">
            <Users className="h-6 w-6" />
          </div>
          <p className="text-sm font-medium text-navy">
            {patients.length === 0 ? "Todavía no atendiste pacientes" : "Sin resultados"}
          </p>
          <p className="max-w-xs text-xs text-slate2">
            {patients.length === 0
              ? "Cuando finalices tu primera consulta, el paciente va a aparecer acá con su historial."
              : "Probá con otro nombre."}
          </p>
        </div>
      ) : (
        <ul className="space-y-2">
          {filtered.map((p) => (
            <li key={p.id}>
              <Link
                href={`/medico/pacientes/${p.id}`}
                className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white p-3 transition-colors hover:border-[var(--color-primary)] hover:bg-teal-50/40"
              >
                <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center overflow-hidden rounded-full bg-[var(--sidebar-primary)] text-sm font-bold text-white">
                  {p.profilePhotoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.profilePhotoUrl} alt={p.fullName} className="h-full w-full object-cover" />
                  ) : (
                    initials(p.fullName)
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-navy">{p.fullName}</p>
                  <p className="flex items-center gap-1.5 text-xs text-slate2">
                    <CalendarDays className="h-3.5 w-3.5" />
                    Última consulta: {format(new Date(p.lastVisit), "d 'de' MMMM yyyy", { locale: es })}
                  </p>
                </div>
                <span className="flex-shrink-0 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-600">
                  {p.visitCount} consulta{p.visitCount === 1 ? "" : "s"}
                </span>
                <ChevronRight className="h-5 w-5 flex-shrink-0 text-slate2" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
