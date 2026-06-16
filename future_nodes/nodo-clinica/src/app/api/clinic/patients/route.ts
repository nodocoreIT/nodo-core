import { NextRequest, NextResponse } from "next/server";
import { readDb, writeDb, publicPatient } from "@/lib/clinic/local-db";
import { getSessionFromRequest } from "@/lib/clinic/session";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim().toLowerCase();
  const doctorId = searchParams.get("doctorId");
  const patientId = searchParams.get("patientId");

  const session = await getSessionFromRequest(request);
  const db = await readDb();

  if (patientId) {
    const patient = db.patients.find((p) => p.id === patientId);
    if (!patient) {
      return NextResponse.json({ error: "Paciente no encontrado" }, { status: 404 });
    }

    const appointments = db.appointments.filter((a) => a.patientId === patientId);
    const documents = db.documents.filter((d) => d.patientId === patientId);
    const records = db.clinicalRecords.filter((r) => r.patientId === patientId);

    return NextResponse.json({
      ...publicPatient(patient),
      stats: {
        appointments: appointments.length,
        documents: documents.length,
        clinicalRecords: records.length,
      },
      lastAppointment: appointments.sort(
        (a, b) =>
          new Date(b.scheduledAt).getTime() - new Date(a.scheduledAt).getTime()
      )[0]?.scheduledAt,
    });
  }

  if (!doctorId) {
    return NextResponse.json({ error: "doctorId requerido" }, { status: 400 });
  }

  if (session?.role === "doctor" && session.userId !== doctorId) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const patientIds = new Set(
    db.appointments.filter((a) => a.doctorId === doctorId).map((a) => a.patientId)
  );

  let patients = db.patients.filter((p) => patientIds.has(p.id));

  if (q) {
    patients = patients.filter(
      (p) =>
        p.fullName.toLowerCase().includes(q) ||
        p.email.toLowerCase().includes(q) ||
        (p.phone?.includes(q) ?? false)
    );
  }

  const results = patients
    .map((patient) => {
      const appointments = db.appointments.filter(
        (a) => a.patientId === patient.id && a.doctorId === doctorId
      );
      const documents = db.documents.filter((d) => d.patientId === patient.id);
      const records = db.clinicalRecords.filter((r) => r.patientId === patient.id);
      const lastApt = appointments.sort(
        (a, b) =>
          new Date(b.scheduledAt).getTime() - new Date(a.scheduledAt).getTime()
      )[0];

      return {
        ...publicPatient(patient),
        stats: {
          appointments: appointments.length,
          documents: documents.length,
          clinicalRecords: records.length,
        },
        lastAppointment: lastApt?.scheduledAt,
        lastStatus: lastApt?.status,
      };
    })
    .sort((a, b) => a.fullName.localeCompare(b.fullName, "es"));

  return NextResponse.json(results);
}

export async function PUT(request: NextRequest) {
  const session = await getSessionFromRequest(request);
  if (!session || session.role !== "patient") {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { profilePhotoData } = await request.json();

  await writeDb((db) => {
    const patient = db.patients.find((p) => p.id === session.userId);
    if (!patient) return;
    if (profilePhotoData !== undefined) {
      patient.profilePhotoData = profilePhotoData;
    }
  });

  const db = await readDb();
  const patient = db.patients.find((p) => p.id === session.userId);
  if (!patient) {
    return NextResponse.json({ error: "Paciente no encontrado" }, { status: 404 });
  }

  return NextResponse.json(publicPatient(patient));
}
