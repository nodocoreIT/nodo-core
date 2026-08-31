import { NextRequest, NextResponse } from "next/server";
import { requireAuth, resolveProfessional } from "@/lib/supabase/auth-guard";
import { createServiceClient } from "@/lib/supabase/server";
import { CLINIC_ORG_ID } from "@/lib/clinic/clinic-org";

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

/**
 * POST /api/clinic/medico/pacientes
 *
 * Creates a patient the doctor is about to attend but who isn't registered yet
 * — a minimal "stub" (name + DNI, optional email) with no auth account. The
 * patient completes their full onboarding later; when they register with the
 * same DNI they claim this exact row and inherit every doctor's history.
 *
 * DNI is the identity key: if a patient with this DNI already exists (created
 * by any doctor, or already registered), it is reused — never duplicated.
 */
export async function POST(request: NextRequest) {
  const authResult = await requireAuth(request);
  if (authResult instanceof NextResponse) return authResult;

  const me = await resolveProfessional(authResult);
  if (!me) {
    return NextResponse.json({ error: "Médico no encontrado" }, { status: 404 });
  }

  const body = await request.json().catch(() => ({}));
  const fullName = typeof body.fullName === "string" ? body.fullName.trim() : "";
  const dni = typeof body.dni === "string" ? body.dni.trim() : "";
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";

  if (!fullName) {
    return NextResponse.json({ error: "El nombre es requerido" }, { status: 400 });
  }
  if (!dni) {
    return NextResponse.json({ error: "El DNI es requerido" }, { status: 400 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const svc = (await createServiceClient()) as any;

  // Reuse-by-DNI: the identity key. Never create a second row for the same DNI.
  const { data: existing } = await svc
    .from("patients")
    .select("id, full_name, dni, email, profile_id")
    .eq("dni", dni)
    .maybeSingle();

  if (existing?.id) {
    return NextResponse.json({
      patient: {
        id: existing.id,
        fullName: existing.full_name ?? fullName,
        dni: existing.dni ?? dni,
        email: existing.email ?? null,
      },
      reused: true,
    });
  }

  const parts = fullName.split(/\s+/);
  const firstName = parts[0] ?? "";
  const lastName = parts.slice(1).join(" ") || firstName;

  const { data: created, error } = await svc
    .from("patients")
    .insert({
      org_id: CLINIC_ORG_ID,
      full_name: fullName,
      first_name: firstName,
      last_name: lastName,
      dni,
      email: email || null,
    })
    .select("id, full_name, dni, email")
    .single();

  if (error) {
    // Unique DNI race: someone inserted the same DNI between our check and
    // insert. Fall back to reusing the now-existing row.
    if (error.code === "23505") {
      const { data: raced } = await svc
        .from("patients")
        .select("id, full_name, dni, email")
        .eq("dni", dni)
        .maybeSingle();
      if (raced?.id) {
        return NextResponse.json({
          patient: {
            id: raced.id,
            fullName: raced.full_name ?? fullName,
            dni: raced.dni ?? dni,
            email: raced.email ?? null,
          },
          reused: true,
        });
      }
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    patient: {
      id: created.id,
      fullName: created.full_name,
      dni: created.dni,
      email: created.email ?? null,
    },
    reused: false,
  });
}
