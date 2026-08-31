import { NextRequest, NextResponse } from "next/server";
import { isLocalMode } from "@/lib/clinic/config";
import { handlePatientHistoryGetLocal } from "@/lib/clinic/patient-history-local-get";
import { requireAuth, resolveProfessional } from "@/lib/supabase/auth-guard";
import { createServiceClient } from "@/lib/supabase/server";
import { buildPatientTimeline } from "@/lib/clinic/patient-timeline";

export async function GET(request: NextRequest) {
  if (isLocalMode()) {
    return handlePatientHistoryGetLocal(request);
  }

  const { searchParams } = new URL(request.url);
  const patientIdParam = searchParams.get("patientId");

  if (!patientIdParam) {
    return NextResponse.json(
      { error: "patientId requerido" },
      { status: 400 },
    );
  }

  const authResult = await requireAuth(request);
  if (authResult instanceof NextResponse) return authResult;
  const { user } = authResult;

  const svc = await createServiceClient();

  let patientRow: { id: string; org_id: string } | null = null;

  if (user.role === "patient") {
    const { data: ownRow } = await svc
      .from("patients")
      .select("id, org_id, profile_id")
      .eq("profile_id", user.id)
      .maybeSingle();

    if (!ownRow) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    const paramMatches =
      patientIdParam === ownRow.id || patientIdParam === ownRow.profile_id;
    if (!paramMatches) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    patientRow = { id: ownRow.id, org_id: ownRow.org_id };
  } else {
    const { data: byPk } = await svc
      .from("patients")
      .select("id, org_id")
      .eq("id", patientIdParam)
      .maybeSingle();

    patientRow = byPk;

    if (!patientRow) {
      return NextResponse.json({ error: "Paciente no encontrado" }, { status: 404 });
    }

    if (user.org_id && patientRow.org_id !== user.org_id) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }
  }

  const patientId = patientRow.id;
  const orgId = patientRow.org_id;

  const [
    { data: rawAppointments },
    { data: clinicalRecords },
    { data: patient },
  ] = await Promise.all([
    svc
      .from("appointments")
      .select("id, scheduled_at, status, doctor_id, patient_documents(*), clinical_notes(*)")
      .eq("patient_id", patientId)
      .eq("org_id", orgId)
      .order("scheduled_at", { ascending: false }),
    svc
      .from("clinical_records")
      .select("*")
      .eq("patient_id", patientId)
      .eq("org_id", orgId)
      .order("created_at", { ascending: false }),
    svc
      .from("patients")
      .select("*, patient_health_profiles(*)")
      .eq("id", patientId)
      .maybeSingle(),
  ]);

  const doctorIds = [
    ...new Set((rawAppointments ?? []).map((apt) => apt.doctor_id).filter(Boolean)),
  ];
  const { data: professionals } =
    doctorIds.length > 0
      ? await svc
          .from("professionals")
          .select("id, full_name, specialty")
          .in("id", doctorIds)
      : { data: [] };

  const professionalById = new Map(
    (professionals ?? []).map((p) => [p.id, p]),
  );

  const recordDoctorIds = [
    ...new Set((clinicalRecords ?? []).map((r) => r.doctor_id).filter(Boolean)),
  ];
  const missingDoctorIds = recordDoctorIds.filter((id) => !professionalById.has(id));
  if (missingDoctorIds.length > 0) {
    const { data: extraPros } = await svc
      .from("professionals")
      .select("id, full_name, specialty")
      .in("id", missingDoctorIds);
    for (const p of extraPros ?? []) {
      professionalById.set(p.id, p);
    }
  }

  const appointments = (rawAppointments ?? []).map((apt) => {
    const doctor = professionalById.get(apt.doctor_id);
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
    doctorName: professionalById.get(r.doctor_id)?.full_name,
  }));

  const timeline = buildPatientTimeline(appointments, records);

  // Health profile: patient sees own, doctor sees if appointment consent exists
  let healthProfile = null;
  if (user.role === "patient") {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    healthProfile = (patient as any)?.patient_health_profiles ?? null;
  } else if (user.role === "doctor") {
    const professional = await resolveProfessional(authResult);
    const doctorId = searchParams.get("doctorId") ?? professional?.id;
    if (doctorId) {
      const { data: consentedApt } = await svc
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
