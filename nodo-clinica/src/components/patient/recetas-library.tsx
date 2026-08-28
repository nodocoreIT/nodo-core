"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Download, Eye, FolderOpen, Loader2, Pill } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { clinicApi } from "@/lib/clinic/client-api";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { buttonVariants } from "@/components/ui/button";
import { toast } from "sonner";

interface PatientPrescription {
  id: string;
  source: "standalone" | "consultation";
  doctorName: string;
  issuedAt: string;
  expiresAt: string;
  isExpired: boolean;
  isViewed: boolean;
  medicationsSummary: string;
}

function downloadUrlFor(item: PatientPrescription): string {
  return item.source === "consultation"
    ? `/api/clinic/clinical-records/pdf?id=${item.id}`
    : `/api/clinic/patient-prescriptions/${item.id}/pdf`;
}

/** "Mis recetas" for the patient portal — merges standalone recetas
 * (paid/waived + sent) with live-consultation recetas, each with a 10-day
 * download window already resolved by the API. Viewing opens a preview
 * modal (same pattern used for the médico's receta preview) instead of
 * navigating away; opening it marks the receta as viewed so the "1 Nueva"
 * sidebar badge clears and the card shows "Descargada" afterwards. */
export function RecetasLibrary() {
  const [prescriptions, setPrescriptions] = useState<PatientPrescription[]>([]);
  const [loading, setLoading] = useState(true);
  const [previewItem, setPreviewItem] = useState<PatientPrescription | null>(null);

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

  const handleOpenPreview = (item: PatientPrescription) => {
    setPreviewItem(item);
  };

  const handleDownloadFromPreview = (item: PatientPrescription) => {
    if (!item.isViewed) {
      setPrescriptions((prev) =>
        prev.map((p) => (p.id === item.id ? { ...p, isViewed: true } : p)),
      );
      clinicApi.markPrescriptionViewed(item.id, item.source).catch(() => {});
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-[var(--color-primary)]" />
      </div>
    );
  }

  return (
    <>
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
                  <div className="flex items-center gap-2">
                    <p className="text-xs text-slate-400">
                      {format(new Date(item.issuedAt), "dd MMM yyyy", { locale: es })}
                    </p>
                    {item.isViewed && !item.isExpired && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-[var(--color-primary)]">
                        <CheckCircle2 className="h-3 w-3" />
                        Descargada
                      </span>
                    )}
                  </div>
                </div>
                {item.isExpired ? (
                  <span className="shrink-0 rounded-full bg-red-50 px-2.5 py-1 text-xs font-medium text-red-600">
                    Vencida — venció el{" "}
                    {format(new Date(item.expiresAt), "dd/MM/yyyy")}
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleOpenPreview(item)}
                    className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-slate-200 bg-white hover:bg-slate-50"
                    aria-label="Ver receta"
                  >
                    <Eye className="h-3.5 w-3.5 text-slate-600" />
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      <Dialog open={!!previewItem} onOpenChange={(open) => !open && setPreviewItem(null)}>
        <DialogContent className="w-[92vw] sm:max-w-5xl h-[90vh] flex flex-col gap-3">
          <DialogHeader className="shrink-0">
            <DialogTitle>Receta médica</DialogTitle>
            <DialogDescription>
              {previewItem?.doctorName} — {previewItem?.medicationsSummary}
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center justify-end shrink-0">
            <a
              href={previewItem ? downloadUrlFor(previewItem) : "#"}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => previewItem && handleDownloadFromPreview(previewItem)}
              className={buttonVariants({ variant: "outline", size: "sm", className: "gap-1.5" })}
            >
              <Download className="h-3.5 w-3.5" />
              Descargar
            </a>
          </div>
          {previewItem && (
            <iframe
              src={`${downloadUrlFor(previewItem)}#zoom=100`}
              className="flex-1 w-full min-h-0 rounded border border-slate-200"
              title="Receta médica"
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
