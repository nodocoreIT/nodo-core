import { NextRequest, NextResponse } from "next/server";
import { isLocalMode } from "@/lib/clinic/config";
import { handlePatientHistoryGetLocal } from "@/lib/clinic/patient-history-local-get";
import { requireAuth } from "@/lib/supabase/auth-guard";
import { buildPatientTimeline } from "@/lib/clinic/patient-timeline";

export async function GET(request: NextRequest) {
  if (isLocalMode()) {
    return handlePatientHistoryGetLocal(request);
  }

  const { searchParams } = new URL(request.url);
  const patientId = searchParams.get("patientId");

  if (!patientId) {
    return NextResponse.json(
      { error: "patientId requerido" },
      { status: 400 },
    );
  }

  const authResult = await requireAuth(request);
  if (authResult instanceof NextResponse) return authResult;
  const { user, supabase } = authResult;

  // Patients can only access their own history
  if (user.role === "patient") {
    const { data: patientRow } = await supabase
      .from("patients")
      .select("id")
      .eq("profile_id", user.id)
      .maybeSingle();
    if (!patientRow || patientRow.id !== patientId) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }
  }

  const [
    { data: rawAppointments },
    { data: clinicalRecords },
    { data: patient },
  ] = await Promise.all([
    supabase
      .from("appointments")
      .select(
        "id, scheduled_at, status, doctor_id, professionals(full_name, specialty), patient_documents(*), clinical_notes(*)",
      )
      .eq("patient_id", patientId)
      .eq("org_id", user.org_id ?? "")
      .order("scheduled_at", { ascending: false }),
    supabase
      .from("clinical_records")
      .select("*, professionals(full_name)")
      .eq("patient_id", patientId)
      .eq("org_id", user.org_id ?? "")
      .order("created_at", { ascending: false }),
    supabase
      .from("patients")
      .select("*, patient_health_profiles(*)")
      .eq("id", patientId)
      .maybeSingle(),
  ]);

  const appointments = (rawAppointments ?? []).map((apt) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const doctor = (apt as any).professionals;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const docs = (apt as any).patient_documents ?? [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const note = (apt as any).clinical_notes;
    return {
      id: apt.id,
      scheduledAt: apt.scheduled_at,
      status: apt.status,
      doctor: doctor
        ? { fullName: doctor.full_name, specialty: doctor.specialty }
        : null,
      documents: docs.map((d: Record<string, unknown>) => ({
        id: d.id,
        fileName: d.file_name,
        mimeType: d.mime_type,
        uploadedAt: d.uploaded_at,
        downloadUrl: `/api/clinic/documents?id=${d.id}&download=1`,
      })),
      clinicalNote: note?.content ?? null,
    };
  });

  const records = (clinicalRecords ?? []).map((r) => ({
    id: r.id,
    title: r.title,
    content: r.content,
    recordType: r.record_type,
    createdAt: r.created_at,
    appointmentId: r.appointment_id,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    doctorName: (r as any).professionals?.full_name,
  }));

  const timeline = buildPatientTimeline(appointments, records);

  // Health profile: patient sees own, doctor sees if appointment consent exists
  let healthProfile = null;
  if (user.role === "patient") {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    healthProfile = (patient as any)?.patient_health_profiles ?? null;
  } else if (user.role === "admin" || user.role === "super_admin") {
    const doctorId = searchParams.get("doctorId");
    if (doctorId) {
      const { data: consentedApt } = await supabase
        .from("appointments")
        .select("id")
        .eq("patient_id", patientId)
        .eq("doctor_id", doctorId)
        .eq("share_health_profile", true)
        .limit(1)
        .maybeSingle();
      if (consentedApt) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        healthProfile = (patient as any)?.patient_health_profiles ?? null;
      }
    }
  }

  return NextResponse.json({
    appointments,
    clinicalRecords: records,
    timeline,
    healthProfile,
  });
}
