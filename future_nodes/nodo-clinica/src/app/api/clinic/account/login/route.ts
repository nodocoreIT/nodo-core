import { NextRequest, NextResponse } from "next/server";
import {
  readDb,
  writeDb,
  publicDoctor,
  publicPatient,
} from "@/lib/clinic/local-db";
import { jsonWithSession, type ClinicSession } from "@/lib/clinic/session";
import {
  hashPassword,
  isPasswordHashed,
  verifyPassword,
} from "@/lib/clinic/password";

export async function POST(request: NextRequest) {
  try {
    const { email, password, role } = await request.json();

    if (!email || !password || !role) {
      return NextResponse.json(
        { error: "Email, contraseña y rol requeridos" },
        { status: 400 },
      );
    }

    const db = await readDb();
    const emailLower = email.toLowerCase().trim();

    if (role === "doctor") {
      const doctor = db.doctors.find((d) => d.email === emailLower);
      if (!doctor || !verifyPassword(password, doctor.password)) {
        return NextResponse.json(
          { error: "Credenciales incorrectas" },
          { status: 401 },
        );
      }
      if (!isPasswordHashed(doctor.password)) {
        await writeDb((d) => {
          const target = d.doctors.find((x) => x.id === doctor.id);
          if (target) target.password = hashPassword(password);
        });
      }
      if (doctor.subscriptionStatus === "expired") {
        return NextResponse.json(
          { error: "Suscripción vencida. Renová tu plan." },
          { status: 403 },
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
        session,
      );
    }

    if (role === "patient") {
      const patient = db.patients.find((p) => p.email === emailLower);
      if (!patient || !verifyPassword(password, patient.password)) {
        return NextResponse.json(
          { error: "Credenciales incorrectas" },
          { status: 401 },
        );
      }
      if (!isPasswordHashed(patient.password)) {
        await writeDb((d) => {
          const target = d.patients.find((x) => x.id === patient.id);
          if (target) target.password = hashPassword(password);
        });
      }
      const session: ClinicSession = {
        userId: patient.id,
        role: "patient",
        email: patient.email,
        fullName: patient.fullName,
      };
      return jsonWithSession(
        {
          user: publicPatient(patient, { includeHealth: true }),
          role: "patient",
          session,
        },
        session,
      );
    }

    return NextResponse.json({ error: "Rol inválido" }, { status: 400 });
  } catch (err) {
    console.error("[login]", err);
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : "Error al ingresar. Reintentá.",
      },
      { status: 500 },
    );
  }
}
