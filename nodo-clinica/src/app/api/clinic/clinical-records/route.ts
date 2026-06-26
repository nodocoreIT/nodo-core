// @ts-nocheck
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/supabase/auth-guard";
import { getRecords, createRecord } from "@/lib/clinic/db/clinical-records";

export async function POST(request: NextRequest) {
  const authResult = await requireAuth(request);
  if (authResult instanceof NextResponse) return authResult;
  const { user, supabase } = authResult;

  try {
    const { patientId, doctorId, appointmentId, title, content, recordType } =
      await request.json();

    if (!patientId || !doctorId || !content?.trim()) {
      return NextResponse.json(
        { error: "patientId, doctorId y content requeridos" },
        { status: 400 },
      );
    }

    if (!user.org_id) {
      return NextResponse.json({ error: "org_id requerido" }, { status: 403 });
    }

    // Verify patient and doctor exist in the org
    const [{ data: patient }, { data: professional }] = await Promise.all([
      supabase
        .from("patients")
        .select("id, full_name")
        .eq("id", patientId)
        .eq("org_id", user.org_id)
        .maybeSingle(),
      supabase
        .from("professionals")
        .select("id, full_name")
        .eq("id", doctorId)
        .eq("org_id", user.org_id)
        .maybeSingle(),
    ]);

    if (!patient || !professional) {
      return NextResponse.json(
        { error: "Paciente o médico no encontrado" },
        { status: 404 },
      );
    }

    const { data: record, error } = await createRecord(supabase, {
      org_id: user.org_id,
      patient_id: patientId,
      doctor_id: doctorId,
      appointment_id: appointmentId || null,
      title:
        title?.trim() ||
        `Informe clínico — ${new Date().toLocaleDateString("es-AR")} · ${professional.full_name}`,
      content: content.trim(),
      record_type: recordType || "informe",
    });

    if (error || !record) {
      return NextResponse.json({ error: error?.message ?? "Error al crear registro" }, { status: 500 });
    }

    return NextResponse.json({
      id: record.id,
      patient_id: record.patient_id,
      doctor_id: record.doctor_id,
      record_type: record.record_type,
      title: record.title,
      content: record.content,
      created_at: record.created_at,
      appointment_id: appointmentId,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error interno";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  const authResult = await requireAuth(request);
  if (authResult instanceof NextResponse) return authResult;
  const { user, supabase } = authResult;

  const { searchParams } = new URL(request.url);
  const patientId = searchParams.get("patientId");
  if (!patientId) {
    return NextResponse.json(
      { error: "patientId requerido" },
      { status: 400 },
    );
  }

  if (!user.org_id) {
    return NextResponse.json({ error: "org_id requerido" }, { status: 403 });
  }

  const { data: records, error } = await getRecords(
    supabase,
    patientId,
    user.org_id,
  );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(
    (records ?? []).map((r) => ({
      id: r.id,
      patient_id: r.patient_id,
      doctor_id: r.doctor_id,
      record_type: r.record_type,
      title: r.title,
      content: r.content,
      created_at: r.created_at,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      doctor: (r as any).professionals
        ? {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            full_name: (r as any).professionals.full_name,
          }
        : undefined,
    })),
  );
}
