import { NextResponse } from "next/server";
import type {
  ClinicDatabase,
  LocalClinicalRecord,
  LocalDocument,
  LocalAppointment,
} from "@/lib/clinic/local-db";
import type { ClinicSession } from "@/lib/clinic/session";

export function unauthorized(message = "Iniciá sesión para continuar") {
  return NextResponse.json({ error: message }, { status: 401 });
}

export function forbidden(message = "No autorizado") {
  return NextResponse.json({ error: message }, { status: 403 });
}

export function findAppointmentByAccessToken(
  db: ClinicDatabase,
  accessToken: string,
): LocalAppointment | undefined {
  return db.appointments.find((a) => a.accessToken === accessToken);
}

export function hasDoctorPatientRelationship(
  db: ClinicDatabase,
  doctorId: string,
  patientId: string,
): boolean {
  return db.appointments.some(
    (a) =>
      a.doctorId === doctorId &&
      a.patientId === patientId &&
      a.status !== "cancelled",
  );
}

/** Paciente autorizó compartir ficha/historia completa con este médico al reservar. */
export function hasHealthProfileConsent(
  db: ClinicDatabase,
  doctorId: string,
  patientId: string,
): boolean {
  return db.appointments.some(
    (a) =>
      a.doctorId === doctorId &&
      a.patientId === patientId &&
      a.shareHealthProfile === true &&
      a.status !== "cancelled",
  );
}

export function doctorCanAccessPatient(
  db: ClinicDatabase,
  doctorId: string,
  patientId: string,
): boolean {
  return hasDoctorPatientRelationship(db, doctorId, patientId);
}

export function doctorCanViewFullPatientHistory(
  db: ClinicDatabase,
  doctorId: string,
  patientId: string,
): boolean {
  return hasHealthProfileConsent(db, doctorId, patientId);
}

export function doctorCanViewClinicalRecord(
  db: ClinicDatabase,
  doctorId: string,
  record: LocalClinicalRecord,
): boolean {
  if (record.doctorId === doctorId) return true;
  return hasHealthProfileConsent(db, doctorId, record.patientId);
}

export function doctorOwnsAppointment(
  db: ClinicDatabase,
  doctorId: string,
  appointmentId: string,
): boolean {
  const apt = db.appointments.find((a) => a.id === appointmentId);
  return apt?.doctorId === doctorId;
}

export function canAccessDocument(
  db: ClinicDatabase,
  doc: LocalDocument,
  session: ClinicSession | null,
  accessToken?: string | null,
): boolean {
  if (accessToken) {
    const apt = findAppointmentByAccessToken(db, accessToken);
    return apt?.id === doc.appointmentId;
  }
  if (!session) return false;
  if (session.role === "patient") {
    return session.userId === doc.patientId;
  }
  const apt = db.appointments.find((a) => a.id === doc.appointmentId);
  if (!apt || apt.doctorId !== session.userId) return false;
  return hasDoctorPatientRelationship(db, session.userId, doc.patientId);
}

export function requireSession(
  session: ClinicSession | null,
): session is ClinicSession {
  return session != null;
}

export function requireDoctorSession(
  session: ClinicSession | null,
  doctorId?: string,
): session is ClinicSession & { role: "doctor" } {
  if (!session || session.role !== "doctor") return false;
  if (doctorId && session.userId !== doctorId) return false;
  return true;
}

export function requirePatientSession(
  session: ClinicSession | null,
  patientId?: string,
): session is ClinicSession & { role: "patient" } {
  if (!session || session.role !== "patient") return false;
  if (patientId && session.userId !== patientId) return false;
  return true;
}
