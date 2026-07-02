import { NextRequest, NextResponse } from "next/server";
import { readDb, writeDb } from "@/lib/clinic/local-db";
import { getSessionFromRequest } from "@/lib/clinic/session";
import {
  doctorOwnsAppointment,
  forbidden,
  requireDoctorSession,
  requirePatientSession,
  requireSession,
  unauthorized,
} from "@/lib/clinic/access-control";

export async function GET(request: NextRequest) {
  const appointmentId = new URL(request.url).searchParams.get("appointmentId");
  if (!appointmentId) {
    return NextResponse.json({ error: "appointmentId requerido" }, { status: 400 });
  }

  const session = await getSessionFromRequest(request);
  if (!requireSession(session)) {
    return unauthorized();
  }

  const db = await readDb();
  const apt = db.appointments.find((a) => a.id === appointmentId);
  if (!apt) {
    return NextResponse.json({ error: "Turno no encontrado" }, { status: 404 });
  }

  if (session.role === "patient") {
    if (!requirePatientSession(session, apt.patientId)) {
      return forbidden();
    }
  } else if (!doctorOwnsAppointment(db, session.userId, appointmentId)) {
    return forbidden("Solo el médico del turno puede ver las notas clínicas");
  }

  const note = db.clinicalNotes[appointmentId];
  return NextResponse.json(note || { content: "" });
}

export async function PUT(request: NextRequest) {
  const session = await getSessionFromRequest(request);
  const { appointmentId, doctorId, content } = await request.json();

  if (!appointmentId || !doctorId) {
    return NextResponse.json({ error: "appointmentId y doctorId requeridos" }, { status: 400 });
  }

  if (!requireDoctorSession(session, doctorId)) {
    return forbidden("Solo el médico autenticado puede guardar notas");
  }

  const db = await readDb();
  if (!doctorOwnsAppointment(db, session.userId, appointmentId)) {
    return forbidden("Turno no asignado a este médico");
  }

  await writeDb((d) => {
    d.clinicalNotes[appointmentId] = {
      appointmentId,
      doctorId,
      content,
      updatedAt: new Date().toISOString(),
    };
  });

  return NextResponse.json({ ok: true });
}
