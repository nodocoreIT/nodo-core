import type { SupabaseClient } from "@supabase/supabase-js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyClient = SupabaseClient<any>;

// ── Clinical Records ──────────────────────────────────────────────────────────

export interface ClinicalRecordInsert {
  org_id: string;
  patient_id: string;
  doctor_id: string;
  appointment_id?: string | null;
  record_type?: string;
  title: string;
  content: string;
}

/** Returns clinical records for a patient, ordered newest-first. */
export async function getRecords(
  supabase: AnyClient,
  patientId: string,
  orgId: string,
) {
  return supabase
    .from("clinical_records")
    .select("*, professionals(full_name)")
    .eq("patient_id", patientId)
    .eq("org_id", orgId)
    .order("created_at", { ascending: false });
}

/** Returns a single clinical record by id. */
export async function getRecordById(
  supabase: AnyClient,
  id: string,
  orgId: string,
) {
  return supabase
    .from("clinical_records")
    .select("*")
    .eq("id", id)
    .eq("org_id", orgId)
    .maybeSingle();
}

/** Inserts a new clinical record. */
export async function createRecord(
  supabase: AnyClient,
  data: ClinicalRecordInsert,
) {
  return supabase.from("clinical_records").insert(data).select().single();
}

// ── Clinical Notes ────────────────────────────────────────────────────────────

export interface ClinicalNoteUpsert {
  appointment_id: string;
  org_id: string;
  doctor_id: string;
  content: string;
}

/** Returns the clinical note for a given appointment. */
export async function getNotes(supabase: AnyClient, appointmentId: string) {
  return supabase
    .from("clinical_notes")
    .select("*")
    .eq("appointment_id", appointmentId)
    .maybeSingle();
}

/** Upserts (creates or updates) the clinical note for an appointment. */
export async function createNote(
  supabase: AnyClient,
  data: ClinicalNoteUpsert,
) {
  return supabase
    .from("clinical_notes")
    .upsert(
      { ...data, updated_at: new Date().toISOString() },
      { onConflict: "appointment_id" },
    )
    .select()
    .single();
}

// ── SOAP Summaries ────────────────────────────────────────────────────────────

export interface SOAPUpsert {
  appointment_id: string;
  org_id: string;
  subjective?: string;
  objective?: string;
  analysis?: string;
  plan?: string;
}

/** Returns the SOAP summary for a given appointment. */
export async function getSOAP(supabase: AnyClient, appointmentId: string) {
  return supabase
    .from("soap_summaries")
    .select("*")
    .eq("appointment_id", appointmentId)
    .maybeSingle();
}

/** Upserts a SOAP summary for an appointment. */
export async function createSOAP(supabase: AnyClient, data: SOAPUpsert) {
  return supabase
    .from("soap_summaries")
    .upsert(data, { onConflict: "appointment_id" })
    .select()
    .single();
}

// ── Prescriptions ─────────────────────────────────────────────────────────────

export interface PrescriptionInsert {
  org_id: string;
  appointment_id: string;
  doctor_id: string;
  patient_id: string;
  medications: unknown;
  pdf_url?: string | null;
}

/** Returns prescriptions for a patient. */
export async function getPrescriptions(
  supabase: AnyClient,
  patientId: string,
  orgId: string,
) {
  return supabase
    .from("prescriptions")
    .select("*")
    .eq("patient_id", patientId)
    .eq("org_id", orgId)
    .order("created_at", { ascending: false });
}

/** Inserts a new prescription. */
export async function createPrescription(
  supabase: AnyClient,
  data: PrescriptionInsert,
) {
  return supabase.from("prescriptions").insert(data).select().single();
}

// ── Study Orders ──────────────────────────────────────────────────────────────

export interface StudyOrderInsert {
  org_id: string;
  appointment_id: string;
  doctor_id: string;
  patient_id: string;
  studies: unknown;
  notes?: string | null;
  pdf_url?: string | null;
}

/** Returns study orders for a patient. */
export async function getStudyOrders(
  supabase: AnyClient,
  patientId: string,
  orgId: string,
) {
  return supabase
    .from("study_orders")
    .select("*")
    .eq("patient_id", patientId)
    .eq("org_id", orgId)
    .order("created_at", { ascending: false });
}

/** Inserts a new study order. */
export async function createStudyOrder(
  supabase: AnyClient,
  data: StudyOrderInsert,
) {
  return supabase.from("study_orders").insert(data).select().single();
}

// ── Transcriptions ────────────────────────────────────────────────────────────

export interface TranscriptionUpsert {
  appointment_id: string;
  org_id: string;
  content?: string;
  segments?: unknown;
}

/** Returns the transcription for a given appointment. */
export async function getTranscriptions(
  supabase: AnyClient,
  appointmentId: string,
) {
  return supabase
    .from("transcriptions")
    .select("*")
    .eq("appointment_id", appointmentId)
    .maybeSingle();
}

/** Upserts a transcription for an appointment. */
export async function createTranscription(
  supabase: AnyClient,
  data: TranscriptionUpsert,
) {
  return supabase
    .from("transcriptions")
    .upsert(
      { ...data, updated_at: new Date().toISOString() },
      { onConflict: "appointment_id" },
    )
    .select()
    .single();
}

// ── Patient Documents (metadata) ──────────────────────────────────────────────

export interface PatientDocumentInsert {
  org_id: string;
  patient_id: string;
  appointment_id: string;
  file_name: string;
  file_path: string;
  mime_type: string;
}

/** Returns patient documents for a given appointment. */
export async function getPatientDocuments(
  supabase: AnyClient,
  filters: {
    appointmentId?: string;
    patientId?: string;
    orgId?: string;
  },
) {
  let query = supabase.from("patient_documents").select("*");
  if (filters.appointmentId)
    query = query.eq("appointment_id", filters.appointmentId);
  if (filters.patientId) query = query.eq("patient_id", filters.patientId);
  if (filters.orgId) query = query.eq("org_id", filters.orgId);
  return query.order("uploaded_at", { ascending: false });
}

/** Inserts a patient document metadata record. */
export async function createPatientDocument(
  supabase: AnyClient,
  data: PatientDocumentInsert,
) {
  return supabase.from("patient_documents").insert(data).select().single();
}
