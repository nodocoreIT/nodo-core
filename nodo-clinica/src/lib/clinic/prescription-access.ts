import { createServiceClient } from "@/lib/supabase/server";
import { resolvePrescriptionByAccessToken } from "@/lib/clinic/prescription-token-auth";

export type PrescriptionAccessResult =
  | { status: "not_found" }
  | {
      status: "needs_registration";
      patientEmail: string;
      patientFullName: string | null;
      accessToken: string;
    }
  | { status: "needs_login"; accessToken: string }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  | { status: "authorized"; prescription: any };

/**
 * Fase 3 of "Recetas" — resolves what a patient landing on the magic-link
 * page (`/paciente/receta/[accessToken]`) should see, in three branches:
 *
 * 1. The receta was issued for an email that has since registered as a
 *    patient in this org, but wasn't linked yet (`patient_id` still null) →
 *    backfill `patient_id` idempotently, then fall through to 2/3 below with
 *    the now-linked id.
 * 2. `patient_id` is still null after the backfill attempt → the patient
 *    genuinely has no account yet → "needs_registration".
 * 3. `patient_id` is set but doesn't match the caller's session (or there's
 *    no session at all) → "needs_login". Matches → "authorized".
 */
export async function resolvePrescriptionAccess(
  accessToken: string,
  sessionPatientId: string | null,
): Promise<PrescriptionAccessResult> {
  const prescription = await resolvePrescriptionByAccessToken(accessToken);
  if (!prescription) {
    return { status: "not_found" };
  }

  let patientId: string | null = prescription.patient_id ?? null;

  if (!patientId && prescription.patient_email) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = (await createServiceClient()) as any;
    const normalizedEmail = String(prescription.patient_email).toLowerCase().trim();

    const { data: match } = await supabase
      .from("patients")
      .select("id")
      .eq("org_id", prescription.org_id)
      .eq("email", normalizedEmail)
      .maybeSingle();

    if (match?.id) {
      // Idempotent backfill: only writes if patient_id is still null at
      // write time, so a concurrent request (or a second click on the same
      // link) can't clobber a link that already happened.
      const { data: updated } = await supabase
        .from("prescriptions")
        .update({ patient_id: match.id })
        .eq("id", prescription.id)
        .is("patient_id", null)
        .select("patient_id")
        .maybeSingle();

      patientId = updated?.patient_id ?? match.id;
      prescription.patient_id = patientId;
    }
  }

  if (!patientId) {
    return {
      status: "needs_registration",
      patientEmail: prescription.patient_email,
      patientFullName: prescription.patient_full_name ?? null,
      accessToken,
    };
  }

  if (!sessionPatientId || sessionPatientId !== patientId) {
    return { status: "needs_login", accessToken };
  }

  return { status: "authorized", prescription };
}
