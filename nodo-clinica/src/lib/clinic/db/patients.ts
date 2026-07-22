import type { SupabaseClient } from "@supabase/supabase-js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyClient = SupabaseClient<any>;

export interface PatientRow {
  id: string;
  org_id: string;
  profile_id: string | null;
  full_name: string;
  email: string;
  phone: string | null;
  profile_photo_url: string | null;
  date_of_birth: string | null;
  medical_record_number: string | null;
  created_at: string;
}

export interface PatientInsert {
  org_id: string;
  full_name: string;
  email: string;
  phone?: string | null;
  profile_photo_url?: string | null;
  date_of_birth?: string | null;
  medical_record_number?: string | null;
  profile_id?: string | null;
}

export interface PatientUpdate {
  first_name?: string | null;
  last_name?: string | null;
  full_name?: string | null;
  email?: string;
  phone?: string | null;
  dni?: string | null;
  address?: string | null;
  profile_photo_url?: string | null;
  date_of_birth?: string | null;
  medical_record_number?: string | null;
}

export interface HealthProfileRow {
  id: string;
  patient_id: string;
  blood_type: string | null;
  allergies: string[] | null;
  chronic_conditions: string[] | null;
  insurance_provider: string | null;
  insurance_number: string | null;
  created_at: string;
  updated_at: string;
}

export interface HealthProfileUpsert {
  patient_id: string;
  blood_type?: string | null;
  allergies?: string[] | null;
  chronic_conditions?: string[] | null;
  insurance_provider?: string | null;
  insurance_number?: string | null;
  height_cm?: number | null;
  weight_kg?: number | null;
  medications?: string | null;
  emergency_contact_name?: string | null;
  emergency_contact_phone?: string | null;
}

/** Returns all patients for an org, optionally filtered by search query. */
export async function getPatients(
  supabase: AnyClient,
  orgId: string,
  q?: string,
) {
  let query = supabase
    .from("patients")
    .select("*")
    .eq("org_id", orgId)
    .order("full_name", { ascending: true });

  if (q) {
    query = query.or(
      `full_name.ilike.%${q}%,email.ilike.%${q}%,phone.ilike.%${q}%,dni.ilike.%${q}%`,
    );
  }

  return query;
}

/** Returns a single patient by id (scoped to org). */
export async function getPatientById(
  supabase: AnyClient,
  id: string,
  orgId: string,
) {
  return supabase
    .from("patients")
    .select("*")
    .eq("id", id)
    .eq("org_id", orgId)
    .maybeSingle();
}

/** Inserts a new patient row. */
export async function createPatient(
  supabase: AnyClient,
  data: PatientInsert,
) {
  return supabase.from("patients").insert(data).select().single();
}

/** Updates an existing patient row. */
export async function updatePatient(
  supabase: AnyClient,
  id: string,
  orgId: string,
  data: PatientUpdate,
) {
  return supabase
    .from("patients")
    .update(data)
    .eq("id", id)
    .eq("org_id", orgId)
    .select()
    .single();
}

/** Returns the health profile for a patient. */
export async function getPatientHealthProfile(
  supabase: AnyClient,
  patientId: string,
) {
  return supabase
    .from("patient_health_profiles")
    .select("*")
    .eq("patient_id", patientId)
    .maybeSingle();
}

/** Upserts (creates or updates) the health profile for a patient. */
export async function upsertHealthProfile(
  supabase: AnyClient,
  data: HealthProfileUpsert,
) {
  return supabase
    .from("patient_health_profiles")
    .upsert(data, { onConflict: "patient_id" })
    .select()
    .single();
}
