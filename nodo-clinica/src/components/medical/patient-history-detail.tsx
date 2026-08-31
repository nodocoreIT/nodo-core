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
  HeartPulse,
  Plus,
  ClipboardList,
} from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { clinicApi, type HealthProfile, type HistoryEntry } from "@/lib/clinic/client-api";
import type { Medication } from "@/types";

type History = Awaited<ReturnType<typeof clinicApi.getMyPatientHistory>>;
type Consultation = History["consultations"][number];
type Prescription = Consultation["prescriptions"][number];
type StudyOrder = Consultation["studyOrders"][number];

type SelectedDoc =
  | { kind: "prescription"; data: Prescription; consultationDate: string }
  | { kind: "studyOrder"; data: StudyOrder; consultationDate: string };

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

// ── Clinical header (antecedentes / alergias / medicación habitual) ──────────

const EMPTY_PROFILE: HealthProfile = {
  bloodType: null,
  allergies: null,
  chronicConditions: null,
  medications: null,
  heightCm: null,
  weightKg: null,
  insuranceProvider: null,
  insuranceNumber: null,
  emergencyContactName: null,
  emergencyContactPhone: null,
  updatedAt: null,
};

function Chips({ values }: { values: string[] | null }) {
  if (!values || values.length === 0) return <span className="text-sm text-slate2">—</span>;
  return (
    <div className="flex flex-wrap gap-1.5">
      {values.map((v, i) => (
        <span key={i} className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700">
          {v}
        </span>
      ))}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-1 text-[11px] font-bold uppercase tracking-wide text-slate2">{label}</p>
      {children}
    </div>
  );
}

function HealthProfileCard({
  patientId,
  profile,
  onSaved,
}: {
  patientId: string;
  profile: HealthProfile | null;
  onSaved: (p: HealthProfile) => void;
}) {
  const p = profile ?? EMPTY_PROFILE;
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    allergies: (p.allergies ?? []).join(", "),
    chronicConditions: (p.chronicConditions ?? []).join(", "),
    medications: p.medications ?? "",
    bloodType: p.bloodType ?? "",
    heightCm: p.heightCm != null ? String(p.heightCm) : "",
    weightKg: p.weightKg != null ? String(p.weightKg) : "",
    insuranceProvider: p.insuranceProvider ?? "",
    insuranceNumber: p.insuranceNumber ?? "",
    emergencyContactName: p.emergencyContactName ?? "",
    emergencyContactPhone: p.emergencyContactPhone ?? "",
  });

  const startEdit = () => {
    setForm({
      allergies: (p.allergies ?? []).join(", "),
      chronicConditions: (p.chronicConditions ?? []).join(", "),
      medications: p.medications ?? "",
      bloodType: p.bloodType ?? "",
      heightCm: p.heightCm != null ? String(p.heightCm) : "",
      weightKg: p.weightKg != null ? String(p.weightKg) : "",
      insuranceProvider: p.insuranceProvider ?? "",
      insuranceNumber: p.insuranceNumber ?? "",
      emergencyContactName: p.emergencyContactName ?? "",
      emergencyContactPhone: p.emergencyContactPhone ?? "",
    });
    setEditing(true);
  };

  const toArray = (s: string) =>
    s.split(",").map((x) => x.trim()).filter(Boolean);

  const handleSave = async () => {
    setSaving(true);
    try {
      const saved = await clinicApi.updatePatientHealthProfile(patientId, {
        allergies: toArray(form.allergies),
        chronicConditions: toArray(form.chronicConditions),
        medications: form.medications.trim() || null,
        bloodType: form.bloodType.trim() || null,
        heightCm: form.heightCm.trim() ? Number(form.heightCm) : null,
        weightKg: form.weightKg.trim() ? Number(form.weightKg) : null,
        insuranceProvider: form.insuranceProvider.trim() || null,
        insuranceNumber: form.insuranceNumber.trim() || null,
        emergencyContactName: form.emergencyContactName.trim() || null,
        emergencyContactPhone: form.emergencyContactPhone.trim() || null,
      });
      onSaved(saved);
      setEditing(false);
    } catch (e) {
      alert(e instanceof Error ? e.message : "Error al guardar la ficha");
    } finally {
      setSaving(false);
    }
  };

  const input =
    "w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-[var(--color-primary)] focus:shadow-[0_0_0_4px_rgba(13,148,136,.16)]";

  return (
    <div className="mb-5 rounded-lg border border-slate-200 bg-white p-4">
      <div className="mb-3 flex items-center justify-between">
        <p className="flex items-center gap-2 text-sm font-bold text-navy">
          <HeartPulse className="h-4 w-4 text-[var(--color-primary)]" /> Ficha del paciente
        </p>
        {!editing && (
          <button
            type="button"
            onClick={startEdit}
            className="flex items-center gap-1 text-xs font-semibold text-[var(--color-primary)] hover:underline"
          >
            <Pencil className="h-3.5 w-3.5" /> Editar
          </button>
        )}
      </div>

      {editing ? (
        <div className="space-y-3">
          <Field label="Alergias (separadas por coma)">
            <input className={input} value={form.allergies} onChange={(e) => setForm({ ...form, allergies: e.target.value })} placeholder="Penicilina, AAS…" />
          </Field>
          <Field label="Antecedentes / enfermedades crónicas (separadas por coma)">
            <input className={input} value={form.chronicConditions} onChange={(e) => setForm({ ...form, chronicConditions: e.target.value })} placeholder="HTA, Diabetes tipo 2…" />
          </Field>
          <Field label="Medicación habitual">
            <textarea className={input} rows={2} value={form.medications} onChange={(e) => setForm({ ...form, medications: e.target.value })} placeholder="Enalapril 10mg/día…" />
          </Field>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Grupo sanguíneo">
              <input className={input} value={form.bloodType} onChange={(e) => setForm({ ...form, bloodType: e.target.value })} placeholder="0+" />
            </Field>
            <Field label="Altura (cm)">
              <input className={input} inputMode="decimal" value={form.heightCm} onChange={(e) => setForm({ ...form, heightCm: e.target.value })} />
            </Field>
            <Field label="Peso (kg)">
              <input className={input} inputMode="decimal" value={form.weightKg} onChange={(e) => setForm({ ...form, weightKg: e.target.value })} />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Obra social">
              <input className={input} value={form.insuranceProvider} onChange={(e) => setForm({ ...form, insuranceProvider: e.target.value })} />
            </Field>
            <Field label="N° de afiliado">
              <input className={input} value={form.insuranceNumber} onChange={(e) => setForm({ ...form, insuranceNumber: e.target.value })} />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Contacto de emergencia">
              <input className={input} value={form.emergencyContactName} onChange={(e) => setForm({ ...form, emergencyContactName: e.target.value })} />
            </Field>
            <Field label="Teléfono de emergencia">
              <input className={input} value={form.emergencyContactPhone} onChange={(e) => setForm({ ...form, emergencyContactPhone: e.target.value })} />
            </Field>
          </div>
          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-1.5 rounded-md bg-[var(--color-primary)] px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-50"
            >
              <Check className="h-3.5 w-3.5" /> {saving ? "Guardando..." : "Guardar"}
            </button>
            <button
              type="button"
              onClick={() => setEditing(false)}
              disabled={saving}
              className="flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
            >
              <X className="h-3.5 w-3.5" /> Cancelar
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Alergias">
            <Chips values={p.allergies} />
          </Field>
          <Field label="Antecedentes / crónicos">
            <Chips values={p.chronicConditions} />
          </Field>
          <Field label="Medicación habitual">
            <p className="whitespace-pre-wrap text-sm text-slate-700">{p.medications?.trim() || "—"}</p>
          </Field>
          <Field label="Grupo sanguíneo · Altura · Peso">
            <p className="text-sm text-slate-700">
              {[p.bloodType, p.heightCm != null ? `${p.heightCm} cm` : null, p.weightKg != null ? `${p.weightKg} kg` : null]
                .filter(Boolean)
                .join(" · ") || "—"}
            </p>
          </Field>
          <Field label="Obra social">
            <p className="text-sm text-slate-700">
              {[p.insuranceProvider, p.insuranceNumber].filter(Boolean).join(" · ") || "—"}
            </p>
          </Field>
          <Field label="Contacto de emergencia">
            <p className="text-sm text-slate-700">
              {[p.emergencyContactName, p.emergencyContactPhone].filter(Boolean).join(" · ") || "—"}
            </p>
          </Field>
        </div>
      )}
    </div>
  );
}

// ── Clinical history evolution (append-only) ─────────────────────────────────

function EvolutionSection({
  patientId,
  entries,
  onAdded,
}: {
  patientId: string;
  entries: HistoryEntry[];
  onAdded: (entry: HistoryEntry) => void;
}) {
  const [adding, setAdding] = useState(false);
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);

  const handleAdd = async () => {
    if (!text.trim()) return;
    setSaving(true);
    try {
      const entry = await clinicApi.addPatientHistoryEntry(patientId, text.trim());
      onAdded(entry);
      setText("");
      setAdding(false);
    } catch (e) {
      alert(e instanceof Error ? e.message : "Error al agregar la evolución");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mb-5 rounded-lg border border-slate-200 bg-white p-4">
      <div className="mb-3 flex items-center justify-between">
        <p className="flex items-center gap-2 text-sm font-bold text-navy">
          <ClipboardList className="h-4 w-4 text-[var(--color-primary)]" /> Evolución médica
        </p>
        {!adding && (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="flex items-center gap-1 text-xs font-semibold text-[var(--color-primary)] hover:underline"
          >
            <Plus className="h-3.5 w-3.5" /> Agregar evolución
          </button>
        )}
      </div>

      {adding && (
        <div className="mb-3 space-y-2 rounded-md bg-teal-50/40 p-3">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={3}
            autoFocus
            placeholder="Nueva entrada de evolución…"
            className="w-full rounded-md border border-slate-200 bg-white p-3 text-sm text-slate-700 outline-none focus:border-[var(--color-primary)] focus:shadow-[0_0_0_4px_rgba(13,148,136,.16)]"
          />
          <p className="text-[11px] text-slate2">
            La evolución no se puede editar ni borrar una vez guardada: forma parte de la historia clínica.
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleAdd}
              disabled={saving || !text.trim()}
              className="flex items-center gap-1.5 rounded-md bg-[var(--color-primary)] px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-50"
            >
              <Check className="h-3.5 w-3.5" /> {saving ? "Guardando..." : "Guardar entrada"}
            </button>
            <button
              type="button"
              onClick={() => {
                setAdding(false);
                setText("");
              }}
              disabled={saving}
              className="flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
            >
              <X className="h-3.5 w-3.5" /> Cancelar
            </button>
          </div>
        </div>
      )}

      {entries.length === 0 ? (
        <p className="text-sm text-slate2">Todavía no hay entradas de evolución.</p>
      ) : (
        <ol className="space-y-3">
          {entries.map((e) => (
            <li key={e.id} className="border-l-2 border-teal-200 pl-3">
              <p className="text-xs font-semibold text-teal-700">
                {format(new Date(e.createdAt), "d 'de' MMMM yyyy · HH:mm", { locale: es })}
              </p>
              <p className="whitespace-pre-wrap text-sm text-slate-700">{e.body}</p>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

// ── Document ficha modal (prescription / study order) ────────────────────────

function DocumentFichaModal({ doc, onClose }: { doc: SelectedDoc; onClose: () => void }) {
  const isPrescription = doc.kind === "prescription";
  const meds: Medication[] = isPrescription && Array.isArray(doc.data.medications)
    ? (doc.data.medications as Medication[])
    : [];
  const studies: string[] = !isPrescription && Array.isArray((doc.data as StudyOrder).studies)
    ? ((doc.data as StudyOrder).studies as string[])
    : [];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-xl bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between">
          <div className="flex items-center gap-2">
            {isPrescription ? (
              <Pill className="h-5 w-5 text-[var(--color-primary)]" />
            ) : (
              <FlaskConical className="h-5 w-5 text-[var(--color-primary)]" />
            )}
            <div>
              <p className="font-display text-lg font-bold text-navy">
                {isPrescription ? "Receta médica" : "Orden de estudio"}
              </p>
              <p className="text-xs text-slate2">
                {format(new Date(doc.data.createdAt), "d 'de' MMMM yyyy", { locale: es })}
              </p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="text-slate2 hover:text-slate-700">
            <X className="h-5 w-5" />
          </button>
        </div>

        {isPrescription ? (
          meds.length === 0 ? (
            <p className="text-sm text-slate2">Esta receta no tiene medicamentos cargados.</p>
          ) : (
            <ul className="space-y-3">
              {meds.map((m, i) => (
                <li key={i} className="rounded-md border border-slate-200 p-3">
                  <p className="font-semibold text-navy">{m.name}</p>
                  <p className="text-sm text-slate-700">
                    {[m.dosage, m.frequency, m.duration].filter(Boolean).join(" · ")}
                  </p>
                  {m.instructions?.trim() && (
                    <p className="mt-1 text-xs text-slate2">{m.instructions}</p>
                  )}
                </li>
              ))}
            </ul>
          )
        ) : (
          <div className="space-y-3">
            {studies.length === 0 ? (
              <p className="text-sm text-slate2">Esta orden no tiene estudios cargados.</p>
            ) : (
              <ul className="list-disc space-y-1 pl-5 text-sm text-slate-700">
                {studies.map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ul>
            )}
            {(doc.data as StudyOrder).notes?.trim() && (
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wide text-slate2">Indicaciones</p>
                <p className="whitespace-pre-wrap text-sm text-slate-700">{(doc.data as StudyOrder).notes}</p>
              </div>
            )}
          </div>
        )}

        {doc.data.pdfUrl && (
          <a
            href={doc.data.pdfUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-5 inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-[var(--color-primary)] hover:bg-slate-50"
          >
            <Download className="h-3.5 w-3.5" /> Descargar PDF
          </a>
        )}
      </div>
    </div>
  );
}

interface ConsultationCardProps {
  consultation: Consultation;
  defaultOpen: boolean;
  patientId: string;
  onNotesUpdated?: (newNotes: string) => void;
  onOpenDoc: (doc: SelectedDoc) => void;
}

function ConsultationCard({ consultation, defaultOpen, patientId, onNotesUpdated, onOpenDoc }: ConsultationCardProps) {
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
                  <FileText className="h-4 w-4" /> Notas de la consulta
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
                  <li key={p.id}>
                    <button
                      type="button"
                      onClick={() => onOpenDoc({ kind: "prescription", data: p, consultationDate: c.scheduledAt })}
                      className="flex w-full items-center justify-between rounded-md bg-slate-50 px-3 py-2 text-left text-sm transition-colors hover:bg-slate-100"
                    >
                      <span className="text-slate-700">
                        Receta del {format(new Date(p.createdAt), "d/MM/yyyy", { locale: es })}
                      </span>
                      <span className="text-xs font-semibold text-[var(--color-primary)]">Ver ficha</span>
                    </button>
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
                  <li key={s.id}>
                    <button
                      type="button"
                      onClick={() => onOpenDoc({ kind: "studyOrder", data: s, consultationDate: c.scheduledAt })}
                      className="flex w-full items-center justify-between rounded-md bg-slate-50 px-3 py-2 text-left text-sm transition-colors hover:bg-slate-100"
                    >
                      <span className="truncate text-slate-700">
                        {s.notes?.trim() || `Orden del ${format(new Date(s.createdAt), "d/MM/yyyy", { locale: es })}`}
                      </span>
                      <span className="ml-2 flex-shrink-0 text-xs font-semibold text-[var(--color-primary)]">Ver ficha</span>
                    </button>
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
  const [selectedDoc, setSelectedDoc] = useState<SelectedDoc | null>(null);

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

      <HealthProfileCard
        patientId={patientId}
        profile={data.healthProfile}
        onSaved={(hp) => setData((prev) => (prev ? { ...prev, healthProfile: hp } : prev))}
      />

      <EvolutionSection
        patientId={patientId}
        entries={data.historyEntries}
        onAdded={(entry) =>
          setData((prev) => (prev ? { ...prev, historyEntries: [entry, ...prev.historyEntries] } : prev))
        }
      />

      <h3 className="mb-2 px-1 text-sm font-bold text-navy">Consultas</h3>
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
              onOpenDoc={setSelectedDoc}
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

      {selectedDoc && <DocumentFichaModal doc={selectedDoc} onClose={() => setSelectedDoc(null)} />}
    </div>
  );
}
