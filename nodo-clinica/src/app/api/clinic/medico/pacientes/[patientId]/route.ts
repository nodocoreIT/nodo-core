import { NextRequest, NextResponse } from "next/server";
import { requireAuth, resolveProfessional } from "@/lib/supabase/auth-guard";
import { createServiceClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * GET /api/clinic/medico/pacientes/[patientId]
 *
 * Returns THIS doctor's completed consultations with the given patient, each
 * with its SOAP summary, clinical notes, prescriptions and study orders — the
 * patient's clinical history as seen by this professional. Scoped to the
 * logged-in doctor (doctor_id = me.id): a doctor never reads another doctor's
 * consultations, even for a shared patient.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ patientId: string }> },
) {
  const { patientId } = await params;

  const authResult = await requireAuth(request);
  if (authResult instanceof NextResponse) return authResult;

  const me = await resolveProfessional(authResult);
  if (!me) {
    return NextResponse.json({ error: "Médico no encontrado" }, { status: 404 });
  }

  // Cast to any: generated types are pinned to "public", so nodo_clinica
  // columns don't type-check on the service client (same as the rest).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const svc = (await createServiceClient()) as any;

  const { data: patient } = await svc
    .from("patients")
    .select("id, full_name, profile_photo_url, date_of_birth, dni")
    .eq("id", patientId)
    .maybeSingle();

  if (!patient) {
    return NextResponse.json({ error: "Paciente no encontrado" }, { status: 404 });
  }

  const { data: apts, error } = await svc
    .from("appointments")
    .select(
      "id, scheduled_at, intake_reason, notes, " +
        "soap_summaries(subjective, objective, analysis, plan), " +
        "clinical_notes(content, updated_at), " +
        "prescriptions(id, medications, pdf_url, created_at), " +
        "study_orders(id, studies, notes, pdf_url, created_at)",
    )
    .eq("doctor_id", me.id)
    .eq("patient_id", patientId)
    .eq("status", "completed")
    .order("scheduled_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const consultations = (apts ?? []).map((apt: any) => {
    const soap = Array.isArray(apt.soap_summaries) ? apt.soap_summaries[0] : apt.soap_summaries;
    const note = Array.isArray(apt.clinical_notes) ? apt.clinical_notes[0] : apt.clinical_notes;
    return {
      id: apt.id,
      scheduledAt: apt.scheduled_at,
      intakeReason: apt.intake_reason ?? null,
      notes: note?.content ?? apt.notes ?? null,
      soap: soap
        ? {
            subjective: soap.subjective ?? null,
            objective: soap.objective ?? null,
            analysis: soap.analysis ?? null,
            plan: soap.plan ?? null,
          }
        : null,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      prescriptions: (apt.prescriptions ?? []).map((p: any) => ({
        id: p.id,
        medications: p.medications,
        pdfUrl: p.pdf_url ?? null,
        createdAt: p.created_at,
      })),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      studyOrders: (apt.study_orders ?? []).map((s: any) => ({
        id: s.id,
        studies: s.studies,
        notes: s.notes ?? null,
        pdfUrl: s.pdf_url ?? null,
        createdAt: s.created_at,
      })),
    };
  });

  return NextResponse.json({
    patient: {
      id: patient.id,
      fullName: patient.full_name,
      profilePhotoUrl: patient.profile_photo_url ?? null,
      dateOfBirth: patient.date_of_birth ?? null,
      dni: patient.dni ?? null,
    },
    consultations,
  });
}
