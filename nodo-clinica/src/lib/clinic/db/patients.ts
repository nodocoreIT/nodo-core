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

export interface PatientOnboardingInput {
  userId: string;
  orgId: string;
  email: string;
  fullName: string;
  firstName: string;
  lastName: string;
  dni: string;
  address: string | null;
  obraSocial: string | null;
  plan: string;
  phone: string | null;
  phoneVerifiedAt: string | null;
  dniFrontPath: string | null;
  dniBackPath: string | null;
}

export const DNI_ALREADY_REGISTERED_MESSAGE =
  "Este DNI ya se encuentra registrado con otro correo. Verificá si ya tenés una cuenta con otro email o contactanos para resolver el inconveniente.";

export const DNI_ALREADY_REGISTERED_CODE = "dni_already_registered";

function isMissingColumnError(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  if (error.code === "42703" || error.code === "PGRST204") return true;
  const msg = error.message ?? "";
  return (
    /column .* does not exist/i.test(msg) ||
    /could not find the .* column of .* in the schema cache/i.test(msg)
  );
}

/** Creates or updates the patient row during self-service onboarding (idempotent). */
export async function upsertPatientOnboardingRecord(
  supabase: AnyClient,
  input: PatientOnboardingInput,
): Promise<{ ok: true; patientId: string } | { ok: false; error: string; code?: string }> {
  const email = input.email.trim().toLowerCase();
  const dni = input.dni.trim();
  const basePayload = {
    profile_id: input.userId,
    org_id: input.orgId,
    first_name: input.firstName,
    last_name: input.lastName,
    full_name: input.fullName,
    dni,
    email,
    address: input.address,
    obra_social: input.obraSocial,
    subscription_plan: input.plan,
    dni_front_path: input.dniFrontPath,
    dni_back_path: input.dniBackPath,
  };

  async function findExistingPatientId(): Promise<string | undefined> {
    const { data: byProfile } = await supabase
      .from("patients")
      .select("id")
      .eq("profile_id", input.userId)
      .maybeSingle();

    if (byProfile?.id) return byProfile.id as string;

    const { data: byEmail } = await supabase
      .from("patients")
      .select("id")
      .ilike("email", email)
      .maybeSingle();

    if (byEmail?.id) return byEmail.id as string;

    if (dni) {
      const { data: byDni } = await supabase
        .from("patients")
        .select("id, profile_id, email")
        .eq("dni", dni)
        .maybeSingle();

      if (byDni?.id) {
        const linkedProfile = byDni.profile_id as string | null;
        if (!linkedProfile || linkedProfile === input.userId) {
          return byDni.id as string;
        }
      }
    }

    return undefined;
  }

  async function resolveDuplicatePatientId(): Promise<string | undefined> {
    const { data: byEmail } = await supabase
      .from("patients")
      .select("id")
      .ilike("email", email)
      .maybeSingle();
    if (byEmail?.id) return byEmail.id as string;

    if (dni) {
      const { data: byDni } = await supabase
        .from("patients")
        .select("id, profile_id")
        .eq("dni", dni)
        .maybeSingle();
      if (byDni?.id) {
        const linkedProfile = byDni.profile_id as string | null;
        if (!linkedProfile || linkedProfile === input.userId) {
          return byDni.id as string;
        }
      }
    }

    return undefined;
  }

  async function writePayload(
    payload: Record<string, unknown>,
  ): Promise<{ ok: true; patientId: string } | { ok: false; error: string; code?: string }> {
    const existingId = await findExistingPatientId();

    if (existingId) {
      const { error } = await supabase.from("patients").update(payload).eq("id", existingId);
      if (error) return { ok: false, error: error.message, code: error.code };
      return { ok: true, patientId: existingId };
    }

    const { data: inserted, error: insertError } = await supabase
      .from("patients")
      .insert(payload)
      .select("id")
      .single();

    if (!insertError && inserted?.id) {
      return { ok: true, patientId: inserted.id as string };
    }

    if (insertError?.code === "23505") {
      const duplicateId = await resolveDuplicatePatientId();
      if (duplicateId) {
        const { error: updateError } = await supabase
          .from("patients")
          .update(payload)
          .eq("id", duplicateId);
        if (updateError) {
          return { ok: false, error: updateError.message, code: updateError.code };
        }
        return { ok: true, patientId: duplicateId };
      }
      if (insertError.message.includes("patients_dni_key")) {
        return {
          ok: false,
          error: DNI_ALREADY_REGISTERED_MESSAGE,
          code: DNI_ALREADY_REGISTERED_CODE,
        };
      }
    }

    if (insertError) {
      return { ok: false, error: insertError.message, code: insertError.code };
    }

    return { ok: false, error: "No se pudo crear el perfil de paciente." };
  }

  // Omit phone columns unless verified — avoids PostgREST errors when columns are missing.
  const payloadVariants: Record<string, unknown>[] = input.phone
    ? [
        { ...basePayload, phone: input.phone, phone_verified_at: input.phoneVerifiedAt },
        { ...basePayload, phone: input.phone },
        basePayload,
      ]
    : [basePayload];

  let lastResult: { ok: true; patientId: string } | { ok: false; error: string; code?: string } = {
    ok: false,
    error: "No se pudo crear el perfil de paciente.",
  };

  for (const payload of payloadVariants) {
    lastResult = await writePayload(payload);
    if (lastResult.ok) return lastResult;
    if (!isMissingColumnError({ code: lastResult.code, message: lastResult.error })) {
      return lastResult;
    }
  }

  return lastResult;
}
