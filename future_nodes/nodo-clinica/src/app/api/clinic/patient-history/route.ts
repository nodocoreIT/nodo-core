import { NextRequest, NextResponse } from "next/server";
import { readDb } from "@/lib/clinic/local-db";
import { getSessionFromRequest } from "@/lib/clinic/session";
import { buildPatientTimeline } from "@/lib/clinic/patient-timeline";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const patientId = searchParams.get("patientId");

  if (!patientId) {
    return NextResponse.json({ error: "patientId requerido" }, { status: 400 });
  }

  const session = await getSessionFromRequest(request);
  if (
    session &&
    session.role === "patient" &&
    session.userId !== patientId
  ) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const db = await readDb();

  const appointments = db.appointments
    .filter((a) => a.patientId === patientId)
    .sort(
      (a, b) =>
        new Date(b.scheduledAt).getTime() - new Date(a.scheduledAt).getTime()
    )
    .map((apt) => {
      const doctor = db.doctors.find((d) => d.id === apt.doctorId);
      const docs = db.documents.filter((d) => d.appointmentId === apt.id);
      const note = db.clinicalNotes[apt.id];
      return {
        id: apt.id,
        scheduledAt: apt.scheduledAt,
        status: apt.status,
        doctor: doctor
          ? {
              fullName: doctor.fullName,
              specialty: doctor.specialty,
            }
          : null,
        documents: docs.map((d) => ({
          id: d.id,
          fileName: d.fileName,
          mimeType: d.mimeType,
          uploadedAt: d.uploadedAt,
          downloadUrl: `/api/clinic/documents?id=${d.id}&download=1`,
        })),
        clinicalNote: note?.content ?? null,
      };
    });

  const clinicalRecords = db.clinicalRecords
    .filter((r) => r.patientId === patientId)
    .sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    )
    .map((r) => ({
      id: r.id,
      title: r.title,
      content: r.content,
      recordType: r.recordType,
      createdAt: r.createdAt,
      appointmentId: r.appointmentId,
      doctorName: db.doctors.find((d) => d.id === r.doctorId)?.fullName,
    }));

  const timeline = buildPatientTimeline(appointments, clinicalRecords);

  const patient = db.patients.find((p) => p.id === patientId);
  let healthProfile = undefined;
  if (session?.role === "patient" && session.userId === patientId) {
    healthProfile = patient?.healthProfile;
  } else if (session?.role === "doctor") {
    const doctorId = searchParams.get("doctorId") ?? session.userId;
    const consented = db.appointments.some(
      (a) =>
        a.patientId === patientId &&
        a.doctorId === doctorId &&
        a.shareHealthProfile,
    );
    if (consented) {
      healthProfile = patient?.healthProfile;
    }
  }

  return NextResponse.json({
    appointments,
    clinicalRecords,
    timeline,
    healthProfile: healthProfile ?? null,
  });
}
