import { NextRequest, NextResponse } from "next/server";
import {
  readDb,
  writeDb,
  newId,
  publicDoctor,
  publicPatient,
} from "@/lib/clinic/local-db";
import {
  jsonWithSession,
  type ClinicSession,
} from "@/lib/clinic/session";
import { hashPassword } from "@/lib/clinic/password";
import { isOpenRegistrationAllowed } from "@/lib/clinic/platform-config";

export async function POST(request: NextRequest) {
  try {
    if (!isOpenRegistrationAllowed()) {
      return NextResponse.json(
        {
          error:
            "El registro abierto está deshabilitado. Suscribite en nodocore.com.ar.",
        },
        { status: 403 },
      );
    }

    const body = await request.json();
    const { role, fullName, email, password, specialty, licenseNumber, phone, plan } =
      body;

    if (!role || !fullName || !email || !password) {
      return NextResponse.json({ error: "Datos incompletos" }, { status: 400 });
    }

    const db = await readDb();
    const emailLower = email.toLowerCase().trim();
    const passwordHash = hashPassword(String(password));

    if (role === "doctor") {
      if (db.doctors.some((d) => d.email === emailLower)) {
        return NextResponse.json(
          { error: "Email ya registrado como médico" },
          { status: 409 },
        );
      }

      const doctor = {
        id: newId("doc"),
        fullName,
        email: emailLower,
        password: passwordHash,
        specialty: specialty || "Medicina General",
        licenseNumber: licenseNumber || "Pendiente",
        subscriptionStatus: "active" as const,
        subscriptionPlan: plan || "trial",
        createdAt: new Date().toISOString(),
      };

      await writeDb((d) => {
        d.doctors.push(doctor);
      });

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
      if (db.patients.some((p) => p.email === emailLower)) {
        return NextResponse.json(
          { error: "Este email ya está registrado como paciente" },
          { status: 409 },
        );
      }

      const patient = {
        id: newId("pat"),
        fullName,
        email: emailLower,
        password: passwordHash,
        phone,
        createdAt: new Date().toISOString(),
      };

      await writeDb((d) => {
        d.patients.push(patient);
      });

      const session: ClinicSession = {
        userId: patient.id,
        role: "patient",
        email: patient.email,
        fullName: patient.fullName,
      };

      return jsonWithSession(
        { user: publicPatient(patient), role: "patient", session },
        session,
      );
    }

    return NextResponse.json({ error: "Rol inválido" }, { status: 400 });
  } catch (err) {
    console.error("[register]", err);
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : "Error al registrar. Reintentá.",
      },
      { status: 500 },
    );
  }
}
