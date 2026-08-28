/**
 * Shared 10-day patient access window for recetas — both standalone
 * (`prescriptions`) and live-consultation (`clinical_records`, record_type
 * "receta") flavors. Purely a logical rule evaluated at request time: no
 * file is deleted, no Storage bucket, no cron job. Past the window the
 * patient simply can no longer view/download the PDF — see
 * `src/app/api/clinic/patient-prescriptions/route.ts`,
 * `src/app/api/clinic/patient-prescriptions/[id]/pdf/route.ts` and the
 * patient-session branch of `src/app/api/clinic/clinical-records/pdf/route.ts`.
 */
export const PRESCRIPTION_ACCESS_WINDOW_DAYS = 10;

const WINDOW_MS = PRESCRIPTION_ACCESS_WINDOW_DAYS * 24 * 60 * 60 * 1000;

export function getPrescriptionExpiresAt(issuedAt: string | Date): Date {
  const issued = typeof issuedAt === "string" ? new Date(issuedAt) : issuedAt;
  return new Date(issued.getTime() + WINDOW_MS);
}

export function isPrescriptionExpired(issuedAt: string | Date): boolean {
  return Date.now() > getPrescriptionExpiresAt(issuedAt).getTime();
}
