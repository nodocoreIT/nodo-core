import { generateSoapSummary } from "@/lib/ai/gemini";
import { formatSoapAsMarkdown } from "@/lib/soap/format";
import type { ClinicDatabase } from "@/lib/clinic/local-db";
import { newId } from "@/lib/clinic/local-db";

interface FinalizeOptions {
  transcription?: string;
  clinicalNotes?: string;
}

export async function appendConsultationArtifacts(
  d: ClinicDatabase,
  appointmentId: string,
  options: FinalizeOptions = {},
): Promise<void> {
  const target = d.appointments.find((a) => a.id === appointmentId);
  if (!target) return;

  const note = d.clinicalNotes[target.id];
  const noteContent = options.clinicalNotes?.trim() || note?.content?.trim() || "";
  const transcription = options.transcription?.trim() || "";

  const hasConsultationRecord = d.clinicalRecords.some(
    (r) =>
      r.appointmentId === target.id &&
      (r.recordType === "consultation" || r.recordType === "evolucion"),
  );

  if (noteContent && !hasConsultationRecord) {
    const doctor = d.doctors.find((doc) => doc.id === target.doctorId);
    d.clinicalRecords.push({
      id: newId("rec"),
      patientId: target.patientId,
      doctorId: target.doctorId,
      appointmentId: target.id,
      title: `Evolución — ${new Date(target.scheduledAt).toLocaleDateString("es-AR")}${doctor ? ` · ${doctor.fullName}` : ""}`,
      content: noteContent,
      recordType: "evolucion",
      createdAt: new Date().toISOString(),
    });
  }

  const hasSoapRecord = d.clinicalRecords.some(
    (r) => r.appointmentId === target.id && r.recordType === "soap",
  );

  if (!hasSoapRecord && (noteContent || transcription)) {
    try {
      const soap = await generateSoapSummary(transcription, noteContent);
      const markdown = formatSoapAsMarkdown(soap);
      const doctor = d.doctors.find((doc) => doc.id === target.doctorId);
      d.clinicalRecords.push({
        id: newId("rec"),
        patientId: target.patientId,
        doctorId: target.doctorId,
        appointmentId: target.id,
        title: `Resumen SOAP — ${new Date(target.scheduledAt).toLocaleDateString("es-AR")}${doctor ? ` · ${doctor.fullName}` : ""}`,
        content: markdown,
        recordType: "soap",
        createdAt: new Date().toISOString(),
      });
    } catch (err) {
      console.error("[SOAP] auto-generate on finalize failed", err);
    }
  }
}
