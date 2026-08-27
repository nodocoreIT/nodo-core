import { NextRequest, NextResponse } from "next/server";
import { requireAuth, resolveProfessional } from "@/lib/supabase/auth-guard";
import { createServiceClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * PATCH /api/clinic/medico/pacientes/[patientId]/consultations/[appointmentId]/notes
 *
 * Update clinical notes for a completed appointment. Only the attending doctor
 * can edit their own notes. Returns the updated note content.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ patientId: string; appointmentId: string }> },
) {
  const { patientId, appointmentId } = await params;
  const body = await request.json();
  const { content } = body as { content?: string };

  if (!content || typeof content !== "string") {
    return NextResponse.json({ error: "Contenido de nota requerido" }, { status: 400 });
  }

  const authResult = await requireAuth(request);
  if (authResult instanceof NextResponse) return authResult;

  const me = await resolveProfessional(authResult);
  if (!me) {
    return NextResponse.json({ error: "Médico no encontrado" }, { status: 404 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const svc = (await createServiceClient()) as any;

  // Verify the appointment exists and belongs to this doctor and patient
  const { data: apt } = await svc
    .from("appointments")
    .select("id, doctor_id, patient_id, status")
    .eq("id", appointmentId)
    .eq("doctor_id", me.id)
    .eq("patient_id", patientId)
    .maybeSingle();

  if (!apt) {
    return NextResponse.json(
      { error: "Consulta no encontrada o no tienes permisos para editarla" },
      { status: 404 },
    );
  }

  // Update or create the clinical note for this appointment
  const { data: note, error: noteError } = await svc
    .from("clinical_notes")
    .upsert(
      {
        appointment_id: appointmentId,
        org_id: me.org_id,
        doctor_id: me.id,
        content: content.trim(),
      },
      { onConflict: "appointment_id" },
    )
    .select("content, updated_at")
    .single();

  if (noteError) {
    return NextResponse.json({ error: noteError.message }, { status: 500 });
  }

  return NextResponse.json({ content: note.content, updatedAt: note.updated_at });
}
