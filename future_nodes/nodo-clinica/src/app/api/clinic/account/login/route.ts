import { NextRequest, NextResponse } from "next/server";
import { readDb, publicDoctor, publicPatient } from "@/lib/clinic/local-db";
import {
  jsonWithSession,
  clearSessionResponse,
  getSessionFromRequest,
  type ClinicSession,
} from "@/lib/clinic/session";

export async function POST(request: NextRequest) {
  const { email, password, role } = await request.json();

  if (!email || !password || !role) {
    return NextResponse.json(
      { error: "Email, contraseña y rol requeridos" },
      { status: 400 }
    );
  }

  const db = await readDb();
  const emailLower = email.toLowerCase().trim();

  if (role === "doctor") {
    const doctor = db.doctors.find(
      (d) => d.email === emailLower && d.password === password
    );
    if (!doctor) {
      return NextResponse.json({ error: "Credenciales incorrectas" }, { status: 401 });
    }
    if (doctor.subscriptionStatus === "expired") {
      return NextResponse.json(
        { error: "Suscripción vencida. Renová tu plan." },
        { status: 403 }
      );
    }
    const session: ClinicSession = {
      userId: doctor.id,
      role: "doctor",
      email: doctor.email,
      fullName: doctor.fullName,
    };
    return jsonWithSession(
      { user: publicDoctor(doctor), role: "doctor", session },
      session
    );
  }

  if (role === "patient") {
    const patient = db.patients.find(
      (p) => p.email === emailLower && p.password === password
    );
    if (!patient) {
      return NextResponse.json({ error: "Credenciales incorrectas" }, { status: 401 });
    }
    const session: ClinicSession = {
      userId: patient.id,
      role: "patient",
      email: patient.email,
      fullName: patient.fullName,
    };
    return jsonWithSession(
      { user: publicPatient(patient, { includeHealth: true }), role: "patient", session },
      session
    );
  }

  return NextResponse.json({ error: "Rol inválido" }, { status: 400 });
}
