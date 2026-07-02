import { createServiceClient } from "@/lib/supabase/server";
import { sanitizeFileName, MAX_FILE_BYTES, ALLOWED_MIME } from "@/lib/clinic/storage";
import { randomUUID } from "crypto";

export interface PatientDocumentRow {
  id: string;
  patient_id: string;
  appointment_id: string;
  org_id: string;
  file_name: string;
  file_path: string;
  mime_type: string;
  uploaded_at: string;
}

/**
 * Uploads a document to Supabase Storage (patient-documents bucket)
 * and inserts a record in nodo_clinica.patient_documents.
 *
 * Storage path: {org_id}/{patient_id}/{timestamp}-{filename}
 */
export async function attachDocumentToAppointment(
  appointmentId: string,
  patientId: string,
  orgId: string,
  fileName: string,
  mimeType: string,
  buffer: Buffer,
): Promise<PatientDocumentRow> {
  if (!ALLOWED_MIME.includes(mimeType as (typeof ALLOWED_MIME)[number])) {
    throw new Error("Formato no permitido (PDF, JPG, PNG)");
  }
  if (buffer.length > MAX_FILE_BYTES) {
    throw new Error("Archivo excede 10 MB");
  }

  const supabase = await createServiceClient();
  const safeName = sanitizeFileName(fileName);
  const storagePath = `${orgId}/${patientId}/${Date.now()}-${safeName}`;

  const { error: uploadError } = await supabase.storage
    .from("patient-documents")
    .upload(storagePath, buffer, {
      contentType: mimeType,
      upsert: false,
    });

  if (uploadError) {
    throw new Error(`Storage upload failed: ${uploadError.message}`);
  }

  const docId = randomUUID();
  const { data, error: insertError } = await supabase
    .from("patient_documents")
    .insert({
      id: docId,
      patient_id: patientId,
      appointment_id: appointmentId,
      org_id: orgId,
      file_name: fileName,
      file_path: storagePath,
      mime_type: mimeType,
      uploaded_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (insertError) {
    // Attempt cleanup of the uploaded file
    await supabase.storage.from("patient-documents").remove([storagePath]);
    throw new Error(`DB insert failed: ${insertError.message}`);
  }

  return data as PatientDocumentRow;
}
