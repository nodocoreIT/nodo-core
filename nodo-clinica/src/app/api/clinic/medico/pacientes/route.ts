import { NextRequest, NextResponse } from "next/server";
import { requireAuth, resolveProfessional } from "@/lib/supabase/auth-guard";
import { createServiceClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * GET /api/clinic/medico/pacientes
 *
 * Lists the patients THIS doctor has attended (completed consultations only),
 * one row per patient with their last visit and total visit count. Scoped to
 * the logged-in professional via resolveProfessional — a doctor never sees
 * another doctor's patients.
 */
export async function GET(request: NextRequest) {
  const authResult = await requireAuth(request);
  if (authResult instanceof NextResponse) return authResult;

  const me = await resolveProfessional(authResult);
  if (!me) {
    return NextResponse.json({ error: "Médico no encontrado" }, { status: 404 });
  }

  // Cast to any: the generated Database types are pinned to the "public"
  // schema, so nodo_clinica columns don't type-check on the service client —
  // same pattern the rest of the clinic endpoints use.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const svc = (await createServiceClient()) as any;
  const { data: apts, error } = await svc
    .from("appointments")
    .select("patient_id, scheduled_at, patients(id, full_name, profile_photo_url)")
    .eq("doctor_id", me.id)
    .eq("status", "completed")
    .order("scheduled_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Ordered newest-first, so the first row seen per patient is their last visit.
  const byPatient = new Map<
    string,
    { id: string; fullName: string; profilePhotoUrl: string | null; lastVisit: string; visitCount: number }
  >();
  for (const apt of apts ?? []) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const patient = (apt as any).patients;
    if (!patient?.id) continue;
    const existing = byPatient.get(patient.id);
    if (existing) {
      existing.visitCount += 1;
    } else {
      byPatient.set(patient.id, {
        id: patient.id,
        fullName: patient.full_name ?? "Paciente",
        profilePhotoUrl: patient.profile_photo_url ?? null,
        lastVisit: apt.scheduled_at,
        visitCount: 1,
      });
    }
  }

  return NextResponse.json({ patients: Array.from(byPatient.values()) });
}
