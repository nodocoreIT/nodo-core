"use client";

import { useEffect, useState } from "react";
import { Download, FolderOpen, Loader2, Pill } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { clinicApi } from "@/lib/clinic/client-api";
import { toast } from "sonner";

interface PatientPrescription {
  id: string;
  source: "standalone" | "consultation";
  doctorName: string;
  issuedAt: string;
  expiresAt: string;
  isExpired: boolean;
  medicationsSummary: string;
}

function downloadUrlFor(item: PatientPrescription): string {
  return item.source === "consultation"
    ? `/api/clinic/clinical-records/pdf?id=${item.id}`
    : `/api/clinic/patient-prescriptions/${item.id}/pdf`;
}

/** "Mis recetas" for the patient portal — merges standalone recetas
 * (paid/waived + sent) with live-consultation recetas, each with a 10-day
 * download window already resolved by the API. */
export function RecetasLibrary() {
  const [prescriptions, setPrescriptions] = useState<PatientPrescription[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    clinicApi
      .getPatientPrescriptions()
      .then((data) => {
        if (active) setPrescriptions(Array.isArray(data) ? data : []);
      })
      .catch((e) => {
        toast.error(e instanceof Error ? e.message : "No se pudieron cargar tus recetas");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-[var(--color-primary)]" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {prescriptions.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-10 text-slate-400">
          <FolderOpen className="h-8 w-8 mb-2 opacity-50" />
          <p className="text-sm">Todavía no tenés recetas</p>
        </div>
      ) : (
        <ul className="space-y-2">
          {prescriptions.map((item) => (
            <li
              key={item.id}
              className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3"
            >
              <Pill className="h-4 w-4 shrink-0 text-slate-400" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-slate-700">
                  {item.doctorName}
                </p>
                <p className="truncate text-xs text-slate-500">
                  {item.medicationsSummary}
                </p>
                <p className="text-xs text-slate-400">
                  {format(new Date(item.issuedAt), "dd MMM yyyy", { locale: es })}
                </p>
              </div>
              {item.isExpired ? (
                <span className="shrink-0 rounded-full bg-red-50 px-2.5 py-1 text-xs font-medium text-red-600">
                  Vencida — venció el{" "}
                  {format(new Date(item.expiresAt), "dd/MM/yyyy")}
                </span>
              ) : (
                <a
                  href={downloadUrlFor(item)}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => {
                    clinicApi
                      .markPrescriptionViewed(item.id, item.source)
                      .catch(() => {});
                  }}
                  className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-slate-200 bg-white hover:bg-slate-50"
                  aria-label="Descargar"
                >
                  <Download className="h-3.5 w-3.5 text-slate-600" />
                </a>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
