/** Placeholder until the doctor picks a specialty on first dashboard login. */
export const UNASSIGNED_SPECIALTY_LABEL = "Sin Asignar";

export function isUnassignedSpecialty(value: string | null | undefined): boolean {
  if (!value?.trim()) return true;
  return value.trim().toLowerCase() === UNASSIGNED_SPECIALTY_LABEL.toLowerCase();
}

export function needsSpecialtyAssignment(
  specialties?: string[] | null,
  legacySpecialty?: string | null,
): boolean {
  const list =
    Array.isArray(specialties) && specialties.length > 0
      ? specialties
      : legacySpecialty
        ? [legacySpecialty]
        : [];
  if (list.length === 0) return true;
  return list.every(isUnassignedSpecialty);
}
