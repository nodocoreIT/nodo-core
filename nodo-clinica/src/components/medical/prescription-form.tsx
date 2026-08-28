"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { FilePlus2, Mail } from "lucide-react";
import { toast } from "sonner";
import type { Medication } from "@/types";
import {
  generatePrescriptionPdf,
  pdfToBase64,
} from "@/lib/pdf/generator";
import { clinicApi } from "@/lib/clinic/client-api";
import {
  MedicationRowsEditor,
  emptyMedication,
  type MedicationDraft,
} from "@/components/medical/medication-rows-editor";

interface PrescriptionFormProps {
  appointmentId: string;
  doctorId: string;
  patientId: string;
  patientName: string;
  doctorName: string;
  doctorSpecialty?: string;
  doctorLicense?: string;
  patientEmail?: string;
  onSaved?: () => void;
}

export function PrescriptionForm({
  appointmentId,
  doctorId,
  patientId,
  patientName,
  doctorName,
  doctorSpecialty,
  doctorLicense,
  patientEmail,
  onSaved,
}: PrescriptionFormProps) {
  const [medications, setMedications] = useState<MedicationDraft[]>([emptyMedication()]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [signatureText, setSignatureText] = useState("");
  const [signatureImageData, setSignatureImageData] = useState("");
  const [signatureLoaded, setSignatureLoaded] = useState(false);

  useEffect(() => {
    clinicApi.getDoctorSchedule(doctorId).then((data) => {
      if (data.signatureText) setSignatureText(data.signatureText);
      if (data.signatureImageData) setSignatureImageData(data.signatureImageData);
    }).catch(() => undefined).finally(() => setSignatureLoaded(true));
  }, []);

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{ signatureText?: string; signatureImageData?: string }>).detail;
      if (!detail) return;
      if (detail.signatureText !== undefined) setSignatureText(detail.signatureText);
      if (detail.signatureImageData !== undefined) setSignatureImageData(detail.signatureImageData);
    };
    window.addEventListener("nodo:signature-updated", handler);
    return () => window.removeEventListener("nodo:signature-updated", handler);
  }, []);

  const handleGenerate = async (sendEmail = false) => {
    const valid = medications.every((m) => m.name && m.dosage);
    if (!valid) {
      toast.error("Complete al menos nombre y dosis de cada medicamento");
      return;
    }

    // Strip the catalog-suggested placeholder fields — they're display-only
    // hints, never the doctor's actual entry, and must not end up persisted
    // in the patient's clinical record.
    const medicationsToSave: Medication[] = medications.map(
      ({ name, dosage, frequency, duration, instructions }) => ({
        name,
        dosage,
        frequency,
        duration,
        instructions,
      }),
    );

    setIsGenerating(true);
    try {
      // Vuelve a pedir la firma justo antes de generar el PDF — si el
      // médico la cargó hace un momento, el estado local puede estar
      // desactualizado todavía (la primera carga es asíncrona) y el PDF
      // saldría sin la imagen de la firma.
      let latestSignatureText = signatureText;
      let latestSignatureImageData = signatureImageData;
      try {
        const fresh = await clinicApi.getDoctorSchedule(doctorId);
        if (fresh.signatureText) latestSignatureText = fresh.signatureText;
        if (fresh.signatureImageData) latestSignatureImageData = fresh.signatureImageData;
        setSignatureText(latestSignatureText);
        setSignatureImageData(latestSignatureImageData);
      } catch {
        /* usa lo que ya había en estado */
      }

      const doc = generatePrescriptionPdf({
        doctor: {
          full_name: doctorName,
          specialty: doctorSpecialty,
          license_number: doctorLicense,
        },
        patientName,
        medications: medicationsToSave,
        signatureText: latestSignatureText || `Dr/a. ${doctorName}`,
        signatureImageData: latestSignatureImageData,
      });

      await clinicApi.savePrescription({
        appointmentId,
        doctorId,
        patientId,
        medications: medicationsToSave,
        pdfBase64: pdfToBase64(doc),
      });

      if (sendEmail && patientEmail) {
        const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
        await fetch(`${basePath}/api/prescriptions/send`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            patientEmail,
            patientName,
            doctorName,
            pdfBase64: pdfToBase64(doc),
          }),
        });
        toast.success("Receta guardada en historial y enviada por email");
      } else {
        toast.success("Receta guardada en historial clínico del paciente");
      }
      onSaved?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al generar la receta");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="space-y-4">
        <MedicationRowsEditor value={medications} onChange={setMedications} />

        {signatureLoaded && !signatureText && !signatureImageData && (
          <p className="text-xs text-amber-700">
            Configurá tu firma en Consultorio → Perfil para que aparezca en recetas y órdenes.
          </p>
        )}

        <div className="flex gap-2">
          <Button
            onClick={() => handleGenerate(false)}
            disabled={isGenerating}
            className="flex-1 bg-blue-700 hover:bg-blue-800"
            size="sm"
          >
            <FilePlus2 className="h-4 w-4 mr-1" />
            Recetar
          </Button>
          {patientEmail && (
            <Button
              onClick={() => handleGenerate(true)}
              disabled={isGenerating}
              variant="outline"
              className="flex-1"
              size="sm"
            >
              <Mail className="h-4 w-4 mr-1" />
              Enviar por email
            </Button>
          )}
        </div>
    </div>
  );
}
