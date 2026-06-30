import { newId, type LocalClinicalRecord, type LocalDocument } from "@/lib/clinic/local-db";

/** Guarda el PDF emitido junto al registro clínico para descarga del paciente. */
export function attachPdfToClinicalRecord(
  db: {
    documents: LocalDocument[];
    clinicalRecords: LocalClinicalRecord[];
  },
  recordId: string,
  opts: {
    patientId: string;
    appointmentId?: string;
    fileName: string;
    pdfBase64: string;
  },
): string {
  const docId = newId("doc");
  const record = db.clinicalRecords.find((r) => r.id === recordId);
  if (!record) return docId;

  db.documents.push({
    id: docId,
    patientId: opts.patientId,
    appointmentId: opts.appointmentId ?? record.appointmentId ?? "",
    fileName: opts.fileName,
    filePath: "",
    mimeType: "application/pdf",
    uploadedAt: new Date().toISOString(),
    inlineDataBase64: opts.pdfBase64.replace(/^data:[^;]+;base64,/, ""),
  });

  record.documentId = docId;
  return docId;
}
