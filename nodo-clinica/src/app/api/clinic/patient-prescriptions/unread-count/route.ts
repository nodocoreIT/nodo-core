import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/supabase/auth-guard";
import { isPrescriptionExpired } from "@/lib/clinic/prescription-expiration";

export const dynamic = "force-dynamic";

/**
 * Count of recetas the patient has not yet downloaded, for the "Mis
 * recetas" sidebar badge. Mirrors the same source filters as
 * `GET /api/clinic/patient-prescriptions` (unified listing) — see that
 * route's doc comment for the standalone-vs-consultation dedup rationale —
 * then excludes expired recetas and rows already marked `viewed_at`.
 */
export async function GET(request: NextRequest) {
  const authResult = await requireAuth(request);
  if (authResult instanceof NextResponse) return authResult;
  const { user, supabase } = authResult;

  if (user.role !== "patient") {
    return NextResponse.json(
      { error: "Debe iniciar sesión como paciente" },
      { status: 401 },
    );
  }

  const { data: patientRow } = await supabase
    .from("patients")
    .select("id")
    .eq("profile_id", user.id)
    .maybeSingle();

  if (!patientRow?.id) {
    return NextResponse.json({ error: "Paciente no encontrado" }, { status: 404 });
  }
  const patientId = patientRow.id;

  const [standaloneResult, consultationResult] = await Promise.all([
    supabase
      .from("prescriptions")
      .select("id, sent_at, viewed_at")
      .eq("patient_id", patientId)
      .in("payment_status", ["confirmed", "waived"])
      .not("sent_at", "is", null)
      .is("viewed_at", null),
    supabase
      .from("clinical_records")
      .select("id, created_at, viewed_at")
      .eq("patient_id", patientId)
      .eq("record_type", "receta")
      .not("appointment_id", "is", null)
      .is("viewed_at", null),
  ]);

  if (standaloneResult.error || consultationResult.error) {
    return NextResponse.json(
      {
        error:
          standaloneResult.error?.message ??
          consultationResult.error?.message ??
          "Error al cargar recetas",
      },
      { status: 500 },
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const standaloneUnread = ((standaloneResult.data ?? []) as any[]).filter(
    (row) => !isPrescriptionExpired(row.sent_at as string),
  ).length;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const consultationUnread = ((consultationResult.data ?? []) as any[]).filter(
    (row) => !isPrescriptionExpired(row.created_at as string),
  ).length;

  return NextResponse.json({ count: standaloneUnread + consultationUnread });
}
