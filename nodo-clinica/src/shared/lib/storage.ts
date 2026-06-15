import { supabase } from "@/shared/lib/supabase";

export const ALLOWED_MIME = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/jpg",
] as const;

export type AllowedMime = (typeof ALLOWED_MIME)[number];

export const MAX_FILE_BYTES = 10 * 1024 * 1024;

export function sanitizeFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120);
}

export function isAllowedMime(mime: string): mime is AllowedMime {
  return (ALLOWED_MIME as readonly string[]).includes(mime);
}

export async function uploadPatientDocument(
  file: File,
  patientId: string,
  appointmentId: string
): Promise<{ path: string; publicUrl: string }> {
  const sanitized = sanitizeFileName(file.name);
  const path = `patients/${patientId}/appointments/${appointmentId}/${Date.now()}_${sanitized}`;

  const { error } = await supabase.storage
    .from("patient-documents")
    .upload(path, file, { contentType: file.type, upsert: false });

  if (error) throw new Error(error.message);

  const { data: urlData } = supabase.storage
    .from("patient-documents")
    .getPublicUrl(path);

  return { path, publicUrl: urlData.publicUrl };
}

export async function getDocumentPublicUrl(path: string): Promise<string> {
  const { data } = supabase.storage
    .from("patient-documents")
    .getPublicUrl(path);
  return data.publicUrl;
}
