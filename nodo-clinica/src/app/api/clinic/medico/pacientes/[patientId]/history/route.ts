import { NextRequest, NextResponse } from "next/server";
import { requireAuth, resolveProfessional } from "@/lib/supabase/auth-guard";
import { createServiceClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * POST /api/clinic/medico/pacientes/[patientId]/history
 *
 * Append a new evolution entry to the patient's clinical history. Append-only:
 * there is no PATCH/DELETE here by design — the record is never rewritten, only
 * extended, to keep medical-legal traceability. Only a doctor who has treated
 * this patient may add entries.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ patientId: string }> },
) {
  const { patientId } = await params;
  const body = await request.json();
  const { body: text, appointmentId } = body as { body?: string; appointmentId?: string | null };

  if (!text || typeof text !== "string" || !text.trim()) {
    return NextResponse.json({ error: "El texto de la evolución es requerido" }, { status: 400 });
  }

  const authResult = await requireAuth(request);
  if (authResult instanceof NextResponse) return authResult;

  const me = await resolveProfessional(authResult);
  if (!me) {
    return NextResponse.json({ error: "Médico no encontrado" }, { status: 404 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const svc = (await createServiceClient()) as any;

  // Authorization: this doctor must have treated the patient.
  const { data: rel } = await svc
    .from("appointments")
    .select("id")
    .eq("doctor_id", me.id)
    .eq("patient_id", patientId)
    .limit(1)
    .maybeSingle();

  if (!rel) {
    return NextResponse.json(
      { error: "No tienes permisos sobre este paciente" },
      { status: 403 },
    );
  }

  const { data: entry, error } = await svc
    .from("clinical_history_entries")
    .insert({
      patient_id: patientId,
      doctor_id: me.id,
      // org_id is left null: resolveProfessional does not expose it, matching
      // the existing clinical_notes behavior. The column stays nullable.
      appointment_id: appointmentId ?? null,
      body: text.trim(),
    })
    .select("id, body, appointment_id, doctor_id, created_at")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    id: entry.id,
    body: entry.body,
    appointmentId: entry.appointment_id ?? null,
    doctorId: entry.doctor_id ?? null,
    createdAt: entry.created_at,
  });
}
