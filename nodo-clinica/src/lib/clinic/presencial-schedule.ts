import type { SupabaseClient } from "@supabase/supabase-js";
import type { DoctorAvailability } from "@/lib/clinic/schedule";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyClient = SupabaseClient<any>;

export interface PresencialInstitution {
  id: string;
  name: string;
  address: string | null;
  city: string | null;
  extra_info: string | null;
  schedule: { days: DoctorAvailability["days"] } | null;
}

export interface PresencialAvailabilityResult {
  /** Whether the doctor has presencial attention enabled at all. */
  enabled: boolean;
  institutions: PresencialInstitution[];
  /** Merged schedule — union of every active institution's own days/times. */
  schedule: DoctorAvailability;
}

/**
 * Fetches `in_person_availability` + the doctor's active `institutions` and
 * builds the merged presencial schedule grid (union of all institutions' own
 * days/times) — the doctor's presencial hours are NOT a single shared grid,
 * each institution manages its own in Instituciones.
 *
 * Shared between the patient booking flow (api/clinic/appointments/route.ts)
 * and the doctor manual-assign flow (lib/clinic/doctor-assign-appointment.ts)
 * so both validate/resolve institutions identically.
 */
export async function resolvePresencialAvailability(
  supabase: AnyClient,
  doctorId: string,
): Promise<PresencialAvailabilityResult> {
  const { data: inPersonAvailability } = await supabase
    .from("in_person_availability")
    .select("availability, enabled")
    .eq("professional_id", doctorId)
    .maybeSingle();

  if (!inPersonAvailability?.enabled) {
    return {
      enabled: false,
      institutions: [],
      schedule: { slotDurationMinutes: 30, days: [] },
    };
  }

  const { data: institutionsData } = await supabase
    .from("institutions")
    .select("id, name, address, city, extra_info, schedule")
    .eq("professional_id", doctorId)
    .eq("active", true)
    .order("id", { ascending: true });

  const institutions: PresencialInstitution[] = institutionsData ?? [];
  const slotDurationMinutes =
    inPersonAvailability.availability?.slotDurationMinutes ?? 30;

  return {
    enabled: true,
    institutions,
    schedule: {
      slotDurationMinutes,
      days: institutions.flatMap((i) => i.schedule?.days ?? []),
    },
  };
}
