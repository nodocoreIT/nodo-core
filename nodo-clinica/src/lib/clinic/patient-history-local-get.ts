import { NextRequest, NextResponse } from "next/server";
import { readDb } from "@/lib/clinic/local-db";
import { getSessionFromRequest } from "@/lib/clinic/session";
import { buildPatientTimeline } from "@/lib/clinic/patient-timeline";
import {
  doctorCanAccessPatient,
  doctorCanViewFullPatientHistory,
  forbidden,
  hasHealthProfileConsent,
  requireSession,
  unauthorized,
} from "@/lib/clinic/access-control";

/** GET /api/clinic/patient-history en CLINIC_MODE=local (JSON). */
export async function handlePatientHistoryGetLocal(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const patientId = searchParams.get("patientId");

  if (!patientId) {
    return NextResponse.json({ error: "patientId requerido" }, { status: 400 });
  }

  const session = await getSessionFromRequest(request);
  if (!requireSession(session)) {
    return unauthorized();
  }

  const db = await readDb();
  const patient = db.patients.find((p) => p.id === patientId);
  if (!patient) {
    return NextResponse.json({ error: "Paciente no encontrado" }, { status: 404 });
  }

  if (session.role === "patient" && session.userId !== patientId) {
    return forbidden();
  }

  if (session.role === "doctor") {
    if (!doctorCanAccessPatient(db, session.userId, patientId)) {
      return forbidden(
        "No tenés relación clínica con este paciente. Solo podés ver historias de pacientes con turno.",
      );
    }
  }

  const fullHistory =
    session.role === "patient" ||
    (session.role === "doctor" &&
      doctorCanViewFullPatientHistory(db, session.userId, patientId));

  const viewingDoctorId = session.role === "doctor" ? session.userId : null;

  let patientAppointments = db.appointments.filter(
    (a) => a.patientId === patientId,
  );
  if (!fullHistory && viewingDoctorId) {
    patientAppointments = patientAppointments.filter(
      (a) => a.doctorId === viewingDoctorId,
    );
  }

  const appointments = patientAppointments
    .sort(
      (a, b) =>
        new Date(b.scheduledAt).getTime() - new Date(a.scheduledAt).getTime(),
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

  let clinicalRecords = db.clinicalRecords.filter(
    (r) => r.patientId === patientId,
  );
  if (!fullHistory && viewingDoctorId) {
    clinicalRecords = clinicalRecords.filter(
      (r) => r.doctorId === viewingDoctorId,
    );
  }

  clinicalRecords = clinicalRecords.sort(
    (a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );

  const mappedRecords = clinicalRecords.map((r) => ({
    id: r.id,
    title: r.title,
    content: r.content,
    recordType: r.recordType,
    createdAt: r.createdAt,
    appointmentId: r.appointmentId,
    doctorName: db.doctors.find((d) => d.id === r.doctorId)?.fullName,
    documentId: r.documentId,
  }));

  const timeline = buildPatientTimeline(appointments, mappedRecords);

  let healthProfile: typeof patient.healthProfile | null = null;
  if (session.role === "patient" && session.userId === patientId) {
    healthProfile = patient.healthProfile ?? null;
  } else if (
    session.role === "doctor" &&
    hasHealthProfileConsent(db, session.userId, patientId)
  ) {
    healthProfile = patient.healthProfile ?? null;
  }

  return NextResponse.json({
    appointments,
    clinicalRecords: mappedRecords,
    timeline,
    healthProfile,
    accessLevel: fullHistory ? "full" : "scoped",
  });
}
