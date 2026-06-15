import { supabase } from "@/shared/lib/supabase";
import type { Patient, Profile } from "@/types";

export async function searchPatients(query: string): Promise<(Patient & { profile: Profile })[]> {
  const { data, error } = await supabase
    .from("patients")
    .select("*, profile:profiles(*)")
    .ilike("profiles.full_name", `%${query}%`)
    .limit(10);

  if (error) throw error;
  return (data ?? []) as unknown as (Patient & { profile: Profile })[];
}

export async function fetchPatient(patientId: string): Promise<(Patient & { profile: Profile }) | null> {
  const { data, error } = await supabase
    .from("patients")
    .select("*, profile:profiles(*)")
    .eq("id", patientId)
    .maybeSingle();

  if (error) throw error;
  return data as unknown as (Patient & { profile: Profile }) | null;
}

export async function fetchPatientByProfileId(
  profileId: string,
): Promise<Patient | null> {
  const { data, error } = await supabase
    .from("patients")
    .select("*")
    .eq("profile_id", profileId)
    .maybeSingle();

  if (error) throw error;
  return data as Patient | null;
}
