import { dayLabel, findScheduleConflictDays, type DaySchedule } from "@/lib/clinic/schedule";

/** Blocks saving an institution's schedule if it overlaps the doctor's
 * virtual hours or another one of their institutions — a doctor can't be in
 * two places (or a video call) at the same time. */
export async function checkInstitutionScheduleConflict(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  professionalId: string,
  newDays: DaySchedule[],
  excludeInstitutionId?: string,
): Promise<string | null> {
  if (newDays.length === 0) return null;

  const [{ data: officeSettings }, { data: siblingInstitutions }] = await Promise.all([
    supabase
      .from("office_settings")
      .select("availability")
      .eq("professional_id", professionalId)
      .maybeSingle(),
    supabase
      .from("institutions")
      .select("id, schedule")
      .eq("professional_id", professionalId)
      .eq("active", true),
  ]);

  const virtualDays = (officeSettings?.availability?.days ?? []) as DaySchedule[];
  const virtualConflicts = findScheduleConflictDays(newDays, virtualDays);
  if (virtualConflicts.length > 0) {
    return `Ese horario choca con tus turnos virtuales el ${virtualConflicts
      .map(dayLabel)
      .join(", ")}. Ajustá los horarios para que no se superpongan.`;
  }

  const otherInstitutionsDays = (siblingInstitutions ?? [])
    .filter((i: { id: string }) => i.id !== excludeInstitutionId)
    .flatMap((i: { schedule?: { days?: DaySchedule[] } }) => i.schedule?.days ?? []);
  const institutionConflicts = findScheduleConflictDays(newDays, otherInstitutionsDays);
  if (institutionConflicts.length > 0) {
    return `Ese horario choca con el de otra institución el ${institutionConflicts
      .map(dayLabel)
      .join(", ")}. Ajustá los horarios para que no se superpongan.`;
  }

  return null;
}
