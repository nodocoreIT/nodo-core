import type { SupabaseClient } from "@supabase/supabase-js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyClient = SupabaseClient<any>;

// ── Institutions ──────────────────────────────────────────────────────────────

export interface InstitutionInsert {
  org_id: string;
  professional_id: string;
  name: string;
  city?: string | null;
  address?: string | null;
  extra_info?: string | null;
  schedule?: unknown;
}

export interface InstitutionUpdate {
  name?: string;
  city?: string | null;
  address?: string | null;
  extra_info?: string | null;
  schedule?: unknown;
}

/** Returns active institutions for a professional, newest-first. */
export async function getInstitutions(
  supabase: AnyClient,
  professionalId: string,
) {
  return supabase
    .from("institutions")
    .select("*")
    .eq("professional_id", professionalId)
    .eq("active", true)
    .order("created_at", { ascending: false });
}

/** Inserts a new institution. */
export async function createInstitution(
  supabase: AnyClient,
  data: InstitutionInsert,
) {
  return supabase.from("institutions").insert(data).select().single();
}

/** Updates an institution by id. */
export async function updateInstitution(
  supabase: AnyClient,
  id: string,
  data: InstitutionUpdate,
) {
  return supabase
    .from("institutions")
    .update({ ...data, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();
}

/** Soft-deletes an institution (active = false). Never hard-deletes — future
 * prescriptions will reference institutions historically. */
export async function deactivateInstitution(supabase: AnyClient, id: string) {
  return supabase
    .from("institutions")
    .update({ active: false, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();
}
