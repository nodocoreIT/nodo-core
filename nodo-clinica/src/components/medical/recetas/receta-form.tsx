"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Download, Loader2, Mail, Save, Search, User } from "lucide-react";
import { toast } from "sonner";
import { useMedicoDoctor } from "@/contexts/medico-doctor-context";
import { clinicApi, type InstitutionRecord } from "@/lib/clinic/client-api";
import {
  MedicationRowsEditor,
  emptyMedication,
  type MedicationDraft,
} from "@/components/medical/medication-rows-editor";
import {
  generatePrescriptionPdf,
  pdfToBase64,
  pdfToBlob,
} from "@/lib/pdf/generator";
import { currencySymbol, formatThousands, parseThousands } from "@/lib/clinic/currency";

interface PatientSearchResult {
  id: string;
  fullName: string;
  email: string;
  dni?: string;
  lastAppointmentAt?: string;
}

interface RecetaFormProps {
  /** Fase 5 — called after a successful "Guardar borrador" or "Enviar
   * receta", so the caller (e.g. the recetas-history dialog) can close the
   * dialog and refresh its list. Optional: the standalone /medico/recetas
   * page rendered the form inline before Fase 5 and had no such callback. */
  onSaved?: () => void;
  /** Fase 6 — when set, the form loads the existing (draft-only) receta and
   * "Guardar borrador"/"Enviar receta" update it in place instead of
   * creating a new one. Absent (the default): the form behaves exactly like
   * before, creating a brand-new receta. */
  editingId?: string;
}

/** Standalone (fuera de consulta) prescription form — Fase 2 de "Recetas".
 * Lets the médico pick a registered patient (or type one that isn't
 * registered), an institution for the PDF letterhead, medications and free
 * notes, and save the receta as a draft. No email/magic-link/payment yet —
 * that's Fase 3/4. Fase 6 adds an edit mode for drafts, gated by `editingId`. */
export function RecetaForm({ onSaved, editingId }: RecetaFormProps = {}) {
  const doctor = useMedicoDoctor();

  const [doctorSpecialty, setDoctorSpecialty] = useState<string | undefined>();
  const [doctorLicense, setDoctorLicense] = useState<string | undefined>();
  const [signatureText, setSignatureText] = useState("");
  const [signatureImageData, setSignatureImageData] = useState("");

  // ── Patient selection ──────────────────────────────────────────────────
  const [unregistered, setUnregistered] = useState(false);
  const [patientQuery, setPatientQuery] = useState("");
  const [patientResults, setPatientResults] = useState<PatientSearchResult[]>([]);
  const [searchingPatients, setSearchingPatients] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState<PatientSearchResult | null>(null);
  const [manualPatientName, setManualPatientName] = useState("");
  const [manualPatientEmail, setManualPatientEmail] = useState("");

  // ── Institution, medications, notes, price ─────────────────────────────
  const [institutions, setInstitutions] = useState<InstitutionRecord[]>([]);
  const [institutionId, setInstitutionId] = useState("");
  const [medications, setMedications] = useState<MedicationDraft[]>([emptyMedication()]);
  const [notes, setNotes] = useState("");
  const [priceAmount, setPriceAmount] = useState<number | undefined>(undefined);

  const [isSaving, setIsSaving] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isLoadingEdit, setIsLoadingEdit] = useState(Boolean(editingId));

  // Preview modal — mismo patrón que PaymentReceiptViewer de nodo-inmo:
  // genera el PDF a un blob y lo muestra en un iframe, con "Descargar" adentro.
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewFilename, setPreviewFilename] = useState("receta.pdf");

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  useEffect(() => {
    clinicApi
      .getDoctorSchedule(doctor.id)
      .then((data) => {
        if (Array.isArray(data.specialties) && data.specialties.length > 0) {
          setDoctorSpecialty(data.specialties[0]);
        }
        if (data.licenseNumber) setDoctorLicense(data.licenseNumber);
        if (data.signatureText) setSignatureText(data.signatureText);
        if (data.signatureImageData) setSignatureImageData(data.signatureImageData);
      })
      .catch(() => undefined);
  }, [doctor.id]);

  useEffect(() => {
    clinicApi
      .getInstitutions()
      .then((data) => setInstitutions(data.institutions))
      .catch(() => undefined);
  }, []);

  // Fase 6 — edit mode: load the existing draft and prefill every field.
  useEffect(() => {
    if (!editingId) return;
    // isLoadingEdit already starts `true` when editingId is set (see useState
    // above) — no need to set it again here, just clear it in .finally().
    clinicApi
      .getPrescription(editingId)
      .then((data) => {
        if (data.patient_id) {
          setUnregistered(false);
          setSelectedPatient({
            id: data.patient_id,
            fullName: data.patient_full_name ?? "Paciente",
            email: data.patient_email ?? "",
          });
        } else {
          setUnregistered(true);
          setManualPatientName(data.patient_full_name ?? "");
          setManualPatientEmail(data.patient_email ?? "");
        }
        setInstitutionId(data.institution_id ?? "");
        const meds = Array.isArray(data.medications) ? data.medications : [];
        setMedications(
          meds.length > 0
            ? meds.map((m: MedicationDraft) => ({
                name: m.name ?? "",
                dosage: m.dosage ?? "",
                frequency: m.frequency ?? "",
                duration: m.duration ?? "",
                instructions: m.instructions ?? "",
              }))
            : [emptyMedication()],
        );
        setNotes(data.notes ?? "");
        setPriceAmount(data.price_amount ?? undefined);
      })
      .catch((err) =>
        toast.error(err instanceof Error ? err.message : "No se pudo cargar la receta"),
      )
      .finally(() => setIsLoadingEdit(false));
  }, [editingId]);

  const searchPatients = useCallback(async (q: string) => {
    if (!q.trim()) {
      setPatientResults([]);
      return;
    }
    setSearchingPatients(true);
    try {
      const res = await clinicApi.searchPatients(q);
      setPatientResults(res);
    } catch {
      setPatientResults([]);
    } finally {
      setSearchingPatients(false);
    }
  }, []);

  useEffect(() => {
    if (unregistered) return;
    const timer = setTimeout(() => void searchPatients(patientQuery), 300);
    return () => clearTimeout(timer);
  }, [patientQuery, unregistered, searchPatients]);

  const selectedInstitution = institutions.find((i) => i.id === institutionId) ?? null;

  const resolvePatientName = () =>
    unregistered ? manualPatientName.trim() : selectedPatient?.fullName ?? "";

  const validate = (): string | null => {
    if (unregistered) {
      if (!manualPatientName.trim() || !manualPatientEmail.trim()) {
        return "Completá nombre y email del paciente no registrado";
      }
    } else if (!selectedPatient) {
      return "Seleccioná un paciente";
    }
    const validMeds = medications.every((m) => m.name && m.dosage);
    if (!validMeds) {
      return "Completá al menos nombre y dosis de cada medicamento";
    }
    return null;
  };

  const buildPdf = () => {
    const medicationsToSave = medications.map(
      ({ name, dosage, frequency, duration, instructions }) => ({
        name,
        dosage,
        frequency,
        duration,
        instructions,
      }),
    );

    return generatePrescriptionPdf({
      doctor: {
        full_name: doctor.fullName,
        specialty: doctorSpecialty,
        license_number: doctorLicense,
      },
      patientName: resolvePatientName(),
      medications: medicationsToSave,
      signatureText: signatureText || `Dr/a. ${doctor.fullName}`,
      signatureImageData,
      institution: selectedInstitution
        ? {
            name: selectedInstitution.name,
            city: selectedInstitution.city ?? undefined,
            address: selectedInstitution.address ?? undefined,
            extraInfo: selectedInstitution.extra_info ?? undefined,
          }
        : undefined,
      notes: notes.trim() || undefined,
    });
  };

  const resetForm = () => {
    setSelectedPatient(null);
    setManualPatientName("");
    setManualPatientEmail("");
    setPatientQuery("");
    setPatientResults([]);
    setInstitutionId("");
    setMedications([emptyMedication()]);
    setNotes("");
    setPriceAmount(undefined);
  };

  /** Shared save step — used by both "Guardar borrador" and "Enviar receta".
   * Returns the saved prescription's id, or null if validation failed
   * (toast already shown). Throws on network/API failure. */
  const saveReceta = async (): Promise<string | null> => {
    const error = validate();
    if (error) {
      toast.error(error);
      return null;
    }

    const medicationsToSave = medications.map(
      ({ name, dosage, frequency, duration, instructions }) => ({
        name,
        dosage,
        frequency,
        duration,
        instructions,
      }),
    );

    const parsedPrice = priceAmount;

    // Fase 6 — edit mode updates the existing receta in place instead of
    // creating a new one. Creation mode still snapshots a PDF preview to
    // send along; the PATCH payload doesn't need it (no pdf_url column is
    // written by either endpoint today).
    if (editingId) {
      const result = await clinicApi.updatePrescription(editingId, {
        patientId: unregistered ? undefined : selectedPatient?.id,
        medications: medicationsToSave,
        institutionId: institutionId || undefined,
        priceAmount:
          typeof parsedPrice === "number" && !Number.isNaN(parsedPrice)
            ? parsedPrice
            : undefined,
        notes: notes.trim() || undefined,
        patientEmail: unregistered ? manualPatientEmail.trim() : selectedPatient?.email,
        patientFullName: unregistered
          ? manualPatientName.trim()
          : selectedPatient?.fullName,
      });
      return result.id;
    }

    const doc = buildPdf();

    const result = await clinicApi.savePrescription({
      doctorId: doctor.id,
      patientId: unregistered ? undefined : selectedPatient?.id,
      medications: medicationsToSave,
      pdfBase64: pdfToBase64(doc),
      institutionId: institutionId || undefined,
      priceAmount:
        typeof parsedPrice === "number" && !Number.isNaN(parsedPrice)
          ? parsedPrice
          : undefined,
      notes: notes.trim() || undefined,
      patientEmail: unregistered ? manualPatientEmail.trim() : selectedPatient?.email,
      patientFullName: unregistered ? manualPatientName.trim() : selectedPatient?.fullName,
    });

    return (result as { id?: string }).id ?? null;
  };

  const handleSaveDraft = async () => {
    setIsSaving(true);
    try {
      const id = await saveReceta();
      if (!id) return;
      toast.success(editingId ? "Receta actualizada" : "Receta guardada como borrador");
      if (!editingId) resetForm();
      onSaved?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al guardar la receta");
    } finally {
      setIsSaving(false);
    }
  };

  const handleSendReceta = async () => {
    setIsSending(true);
    try {
      const id = await saveReceta();
      if (!id) return;
      await clinicApi.sendPrescription(id);
      toast.success("Receta enviada por email al paciente");
      if (!editingId) resetForm();
      onSaved?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al enviar la receta");
    } finally {
      setIsSending(false);
    }
  };

  const handleDownloadPreview = () => {
    const error = validate();
    if (error) {
      toast.error(error);
      return;
    }
    setIsDownloading(true);
    try {
      const doc = buildPdf();
      const safeName = resolvePatientName().replace(/\s+/g, "_") || "receta";
      const blob = pdfToBlob(doc);
      const url = URL.createObjectURL(blob);
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl(url);
      setPreviewFilename(`receta_${safeName}.pdf`);
      setPreviewOpen(true);
    } finally {
      setIsDownloading(false);
    }
  };

  const handleDownloadFromPreview = () => {
    if (!previewUrl) return;
    const a = document.createElement("a");
    a.href = previewUrl;
    a.download = previewFilename;
    a.click();
  };

  if (isLoadingEdit) {
    return (
      <div className="flex items-center justify-center py-10">
        <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <>
    <div className="space-y-6 max-w-2xl">
      {/* Paciente */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-sm font-medium">Paciente</Label>
          <div className="flex items-center gap-2">
            <Checkbox
              id="unregistered-patient"
              checked={unregistered}
              onCheckedChange={(checked) => {
                setUnregistered(checked === true);
                setSelectedPatient(null);
              }}
            />
            <label htmlFor="unregistered-patient" className="text-xs text-slate-600 cursor-pointer">
              Paciente no registrado
            </label>
          </div>
        </div>

        {unregistered ? (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Nombre completo</Label>
              <Input
                value={manualPatientName}
                onChange={(e) => setManualPatientName(e.target.value)}
                placeholder="Nombre y apellido"
                className="h-9 text-sm"
              />
            </div>
            <div>
              <Label className="text-xs">Email</Label>
              <Input
                type="email"
                value={manualPatientEmail}
                onChange={(e) => setManualPatientEmail(e.target.value)}
                placeholder="paciente@email.com"
                className="h-9 text-sm"
              />
            </div>
          </div>
        ) : selectedPatient ? (
          <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-slate-400" />
              <div>
                <p className="text-sm font-medium text-slate-900">{selectedPatient.fullName}</p>
                <p className="text-xs text-slate-500">{selectedPatient.email}</p>
              </div>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setSelectedPatient(null)}>
              Cambiar
            </Button>
          </div>
        ) : (
          <div className="relative">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
              <Input
                value={patientQuery}
                onChange={(e) => setPatientQuery(e.target.value)}
                placeholder="Buscar por nombre, email o DNI…"
                className="pl-9 h-9 text-sm"
              />
            </div>
            {searchingPatients && (
              <div className="flex items-center justify-center py-3">
                <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
              </div>
            )}
            {!searchingPatients && patientResults.length > 0 && (
              <ul className="mt-1 max-h-48 overflow-y-auto rounded-md border bg-white shadow-sm text-sm divide-y">
                {patientResults.map((p) => (
                  <li key={p.id}>
                    <button
                      type="button"
                      className="w-full text-left px-3 py-2 hover:bg-slate-50"
                      onClick={() => {
                        setSelectedPatient(p);
                        setPatientQuery("");
                        setPatientResults([]);
                      }}
                    >
                      <p className="font-medium text-slate-900">{p.fullName}</p>
                      <p className="text-xs text-slate-500">{p.email}</p>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {!searchingPatients && patientQuery.trim() && patientResults.length === 0 && (
              <div className="mt-1 rounded-md border bg-white px-3 py-2 text-sm text-slate-500 shadow-sm">
                Paciente no encontrado.{" "}
                <button
                  type="button"
                  className="font-medium text-emerald-600 hover:underline"
                  onClick={() => setUnregistered(true)}
                >
                  Cargar como no registrado
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Institución */}
      <div className="space-y-1.5">
        <Label className="text-sm font-medium">Institución (membrete del PDF)</Label>
        <select
          value={institutionId}
          onChange={(e) => setInstitutionId(e.target.value)}
          className="flex h-9 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <option value="">Sin institución</option>
          {institutions.map((inst) => (
            <option key={inst.id} value={inst.id}>
              {inst.name}
            </option>
          ))}
        </select>
      </div>

      {/* Medicamentos */}
      <div className="space-y-2">
        <Label className="text-sm font-medium">Medicamentos</Label>
        <MedicationRowsEditor value={medications} onChange={setMedications} />
      </div>

      {/* Indicaciones */}
      <div className="space-y-1.5">
        <Label className="text-sm font-medium">Indicaciones / notas</Label>
        <Textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Indicaciones libres para el paciente…"
          rows={3}
        />
      </div>

      {/* Precio */}
      <div className="space-y-1.5 max-w-xs">
        <Label className="text-sm font-medium">Precio</Label>
        <div className="relative">
          <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-sm text-slate-500">
            {currencySymbol()}
          </span>
          <Input
            type="text"
            inputMode="numeric"
            value={formatThousands(priceAmount)}
            onChange={(e) => setPriceAmount(parseThousands(e.target.value))}
            placeholder="15.000"
            className="h-9 pl-8 text-sm"
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-2 pt-2">
        <Button
          onClick={handleSaveDraft}
          disabled={isSaving || isSending || isLoadingEdit}
          className="gap-2"
        >
          {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Guardar borrador
        </Button>
        <Button
          onClick={handleSendReceta}
          disabled={isSaving || isSending || isLoadingEdit}
          className="gap-2 bg-teal-600 hover:bg-teal-700"
        >
          {isSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
          Enviar receta
        </Button>
        <Button
          variant="outline"
          onClick={handleDownloadPreview}
          disabled={isDownloading}
          className="gap-2"
        >
          {isDownloading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Download className="h-4 w-4" />
          )}
          Vista previa
        </Button>
      </div>
    </div>

    <Dialog
      open={previewOpen}
      onOpenChange={(open) => {
        setPreviewOpen(open);
        if (!open && previewUrl) {
          URL.revokeObjectURL(previewUrl);
          setPreviewUrl(null);
        }
      }}
    >
      <DialogContent className="w-[92vw] sm:max-w-5xl h-[90vh] flex flex-col gap-3">
        <DialogHeader className="shrink-0">
          <DialogTitle>Vista previa de la receta</DialogTitle>
          <DialogDescription>{resolvePatientName() || "—"}</DialogDescription>
        </DialogHeader>
        <div className="flex items-center justify-end shrink-0">
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            disabled={!previewUrl}
            onClick={handleDownloadFromPreview}
          >
            <Download className="h-3.5 w-3.5" />
            Descargar
          </Button>
        </div>
        {previewUrl && (
          <iframe
            src={`${previewUrl}#zoom=150`}
            className="flex-1 w-full min-h-0 rounded border border-slate-200"
            title="Vista previa de la receta"
          />
        )}
      </DialogContent>
    </Dialog>
    </>
  );
}
