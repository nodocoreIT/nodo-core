"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ChevronDown,
  Loader2,
  Stethoscope,
  FileText,
  Pill,
  FlaskConical,
  Download,
  Pencil,
  Check,
  X,
} from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { clinicApi } from "@/lib/clinic/client-api";

type History = Awaited<ReturnType<typeof clinicApi.getMyPatientHistory>>;
type Consultation = History["consultations"][number];

function initials(value: string): string {
  const parts = value.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return value.trim().slice(0, 2).toUpperCase() || "?";
}

function age(dob: string | null): number | null {
  if (!dob) return null;
  const birth = new Date(dob);
  if (Number.isNaN(birth.getTime())) return null;
  const now = new Date();
  let years = now.getFullYear() - birth.getFullYear();
  const m = now.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) years--;
  return years;
}

function SoapBlock({ label, value }: { label: string; value: string | null }) {
  if (!value?.trim()) return null;
  return (
    <div>
      <p className="text-[11px] font-bold uppercase tracking-wide text-teal-700">{label}</p>
      <p className="whitespace-pre-wrap text-sm text-slate-700">{value}</p>
    </div>
  );
}

interface ConsultationCardProps {
  consultation: Consultation;
  defaultOpen: boolean;
  patientId: string;
  onNotesUpdated?: (newNotes: string) => void;
}

function ConsultationCard({ consultation, defaultOpen, patientId, onNotesUpdated }: ConsultationCardProps) {
  const [open, setOpen] = useState(defaultOpen);
  const [editingNotes, setEditingNotes] = useState(false);
  const [notesContent, setNotesContent] = useState(consultation.notes ?? "");
  const [saving, setSaving] = useState(false);
  const c = consultation;
  const hasSoap = c.soap && (c.soap.subjective || c.soap.objective || c.soap.analysis || c.soap.plan);

  const handleSaveNotes = async () => {
    setSaving(true);
    try {
      await clinicApi.updateConsultationNotes(patientId, c.id, notesContent);
      setEditingNotes(false);
      onNotesUpdated?.(notesContent);
    } catch (e) {
      alert(e instanceof Error ? e.message : "Error al guardar las notas");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-3 p-4 text-left transition-colors hover:bg-slate-50"
      >
        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-teal-50 text-teal-700">
          <Stethoscope className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-navy">
            {format(new Date(c.scheduledAt), "EEEE d 'de' MMMM yyyy", { locale: es })}
          </p>
          <p className="truncate text-xs text-slate2">
            {c.intakeReason?.trim() ? c.intakeReason : "Sin motivo registrado"}
          </p>
        </div>
        <ChevronDown
          className={`h-5 w-5 flex-shrink-0 text-slate2 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div className="space-y-4 border-t border-slate-100 p-4">
          {hasSoap && (
            <div className="space-y-3 rounded-md bg-teal-50/40 p-3">
              <p className="flex items-center gap-1.5 text-xs font-bold text-teal-800">
                <FileText className="h-4 w-4" /> Resumen de la consulta (SOAP)
              </p>
              <SoapBlock label="Subjetivo" value={c.soap!.subjective} />
              <SoapBlock label="Objetivo" value={c.soap!.objective} />
              <SoapBlock label="Análisis" value={c.soap!.analysis} />
              <SoapBlock label="Plan" value={c.soap!.plan} />
            </div>
          )}

          {(c.notes?.trim() || editingNotes) && (
            <div>
              <div className="mb-1 flex items-center justify-between">
                <p className="flex items-center gap-1.5 text-xs font-bold text-slate-600">
                  <FileText className="h-4 w-4" /> Notas clínicas
                </p>
                {!editingNotes && (
                  <button
                    type="button"
                    onClick={() => setEditingNotes(true)}
                    className="flex items-center gap-1 text-xs font-semibold text-[var(--color-primary)] hover:underline"
                  >
                    <Pencil className="h-3.5 w-3.5" /> Editar
                  </button>
                )}
              </div>
              {editingNotes ? (
                <div className="space-y-2">
                  <textarea
                    value={notesContent}
                    onChange={(e) => setNotesContent(e.target.value)}
                    className="w-full rounded-md border border-slate-200 bg-white p-3 text-sm text-slate-700 outline-none focus:border-[var(--color-primary)] focus:shadow-[0_0_0_4px_rgba(13,148,136,.16)]"
                    rows={4}
                  />
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={handleSaveNotes}
                      disabled={saving}
                      className="flex items-center gap-1.5 rounded-md bg-[var(--color-primary)] px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-50"
                    >
                      <Check className="h-3.5 w-3.5" /> {saving ? "Guardando..." : "Guardar"}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setEditingNotes(false);
                        setNotesContent(c.notes ?? "");
                      }}
                      disabled={saving}
                      className="flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                    >
                      <X className="h-3.5 w-3.5" /> Cancelar
                    </button>
                  </div>
                </div>
              ) : (
                <p className="whitespace-pre-wrap text-sm text-slate-700">{notesContent}</p>
              )}
            </div>
          )}

          {c.prescriptions.length > 0 && (
            <div>
              <p className="mb-1.5 flex items-center gap-1.5 text-xs font-bold text-slate-600">
                <Pill className="h-4 w-4" /> Recetas ({c.prescriptions.length})
              </p>
              <ul className="space-y-1">
                {c.prescriptions.map((p) => (
                  <li key={p.id} className="flex items-center justify-between rounded-md bg-slate-50 px-3 py-2 text-sm">
                    <span className="text-slate-700">
                      Receta del {format(new Date(p.createdAt), "d/MM/yyyy", { locale: es })}
                    </span>
                    {p.pdfUrl && (
                      <a
                        href={p.pdfUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-xs font-semibold text-[var(--color-primary)] hover:underline"
                      >
                        <Download className="h-3.5 w-3.5" /> PDF
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {c.studyOrders.length > 0 && (
            <div>
              <p className="mb-1.5 flex items-center gap-1.5 text-xs font-bold text-slate-600">
                <FlaskConical className="h-4 w-4" /> Órdenes de estudio ({c.studyOrders.length})
              </p>
              <ul className="space-y-1">
                {c.studyOrders.map((s) => (
                  <li key={s.id} className="flex items-center justify-between rounded-md bg-slate-50 px-3 py-2 text-sm">
                    <span className="text-slate-700">
                      {s.notes?.trim() || `Orden del ${format(new Date(s.createdAt), "d/MM/yyyy", { locale: es })}`}
                    </span>
                    {s.pdfUrl && (
                      <a
                        href={s.pdfUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-xs font-semibold text-[var(--color-primary)] hover:underline"
                      >
                        <Download className="h-3.5 w-3.5" /> PDF
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {!hasSoap && !c.notes?.trim() && c.prescriptions.length === 0 && c.studyOrders.length === 0 && (
            <p className="text-sm text-slate2">Esta consulta no tiene registros clínicos cargados.</p>
          )}
        </div>
      )}
    </div>
  );
}

export function PatientHistoryDetail({ patientId }: { patientId: string }) {
  const router = useRouter();
  const [data, setData] = useState<History | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    clinicApi
      .getMyPatientHistory(patientId)
      .then((d) => {
        if (active) setData(d);
      })
      .catch((e) => {
        if (active) setError(e instanceof Error ? e.message : "Error al cargar la historia clínica");
      });
    return () => {
      active = false;
    };
  }, [patientId]);

  if (error) {
    return (
      <div className="mx-auto max-w-3xl">
        <button
          type="button"
          onClick={() => router.push("/medico/pacientes")}
          className="mb-4 flex items-center gap-1.5 text-sm font-semibold text-[var(--color-primary)] hover:underline"
        >
          <ArrowLeft className="h-4 w-4" /> Volver a Pacientes
        </button>
        <p className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-[var(--color-primary)]" />
      </div>
    );
  }

  const patientAge = age(data.patient.dateOfBirth);

  return (
    <div className="mx-auto max-w-3xl">
      <button
        type="button"
        onClick={() => router.push("/medico/pacientes")}
        className="mb-4 flex items-center gap-1.5 text-sm font-semibold text-[var(--color-primary)] hover:underline"
      >
        <ArrowLeft className="h-4 w-4" /> Volver a Pacientes
      </button>

      <div className="mb-5 flex items-center gap-4 rounded-lg border border-slate-200 bg-white p-4">
        <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center overflow-hidden rounded-full bg-[var(--sidebar-primary)] text-lg font-bold text-white">
          {data.patient.profilePhotoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={data.patient.profilePhotoUrl} alt={data.patient.fullName} className="h-full w-full object-cover" />
          ) : (
            initials(data.patient.fullName)
          )}
        </div>
        <div className="min-w-0">
          <h2 className="truncate font-display text-xl font-bold text-navy">{data.patient.fullName}</h2>
          <p className="text-sm text-slate2">
            {[
              data.patient.dni ? `DNI ${data.patient.dni}` : null,
              patientAge != null ? `${patientAge} años` : null,
              `${data.consultations.length} consulta${data.consultations.length === 1 ? "" : "s"}`,
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>
      </div>

      {data.consultations.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-200 bg-white py-12 text-center text-sm text-slate2">
          Todavía no hay consultas registradas con este paciente.
        </div>
      ) : (
        <div className="space-y-3">
          {data.consultations.map((c, i) => (
            <ConsultationCard
              key={c.id}
              consultation={c}
              defaultOpen={i === 0}
              patientId={patientId}
              onNotesUpdated={(newNotes) => {
                setData((prev) =>
                  prev
                    ? {
                        ...prev,
                        consultations: prev.consultations.map((cons) =>
                          cons.id === c.id ? { ...cons, notes: newNotes } : cons,
                        ),
                      }
                    : null,
                );
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
