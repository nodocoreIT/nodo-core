import { NextRequest, NextResponse } from "next/server";
import {
  readDb,
  writeDb,
  newId,
  publicDoctor,
  publicPatient,
} from "@/lib/clinic/local-db";
import { hashPassword } from "@/lib/clinic/password";

export const dynamic = "force-dynamic";

function assertAdmin(
  request: NextRequest,
): { ok: true } | { ok: false; error: string; status: number } {
  const secret = process.env.CLINIC_ADMIN_SECRET?.trim();
  if (!secret) {
    return {
      ok: false,
      status: 503,
      error:
        "CLINIC_ADMIN_SECRET no está en Vercel. Settings → Environment Variables → agregalo y redeploy.",
    };
  }
  const header = request.headers.get("x-clinic-admin-secret");
  if (header !== secret) {
    return {
      ok: false,
      status: 401,
      error:
        "x-clinic-admin-secret incorrecto. Debe ser el valor de CLINIC_ADMIN_SECRET en Vercel (no la contraseña de login).",
    };
  }
  return { ok: true };
}

/**
 * Crear usuarios de prueba sin UI (solo con CLINIC_ADMIN_SECRET).
 * POST { role: "doctor"|"patient", fullName, email, password, specialty?, licenseNumber?, phone? }
 */
export async function POST(request: NextRequest) {
  const auth = assertAdmin(request);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const body = await request.json();
  const { role, fullName, email, password, specialty, licenseNumber, phone } =
    body;

  if (!role || !fullName || !email || !password) {
    return NextResponse.json({ error: "Datos incompletos" }, { status: 400 });
  }

  const db = await readDb();
  const emailLower = String(email).toLowerCase().trim();

  if (role === "doctor") {
    if (db.doctors.some((d) => d.email === emailLower)) {
      return NextResponse.json({ error: "Email ya registrado" }, { status: 409 });
    }

    const doctor = {
      id: newId("doc"),
      fullName: String(fullName).trim(),
      email: emailLower,
      password: hashPassword(String(password)),
      specialty: specialty || "Medicina General",
      licenseNumber: licenseNumber || "Pendiente",
      subscriptionStatus: "active" as const,
      subscriptionPlan: "trial",
      payment: {
        requirePaymentBeforeBooking: true,
        consultationFee: 100,
        currency: "ARS",
        mercadopagoEnabled: true,
      },
      createdAt: new Date().toISOString(),
    };

    await writeDb((d) => {
      d.doctors.push(doctor);
    });

    return NextResponse.json({
      ok: true,
      role: "doctor",
      user: publicDoctor(doctor),
      loginUrl: "/login/medico",
    });
  }

  if (role === "patient") {
    if (db.patients.some((p) => p.email === emailLower)) {
      return NextResponse.json({ error: "Email ya registrado" }, { status: 409 });
    }

    const patient = {
      id: newId("pat"),
      fullName: String(fullName).trim(),
      email: emailLower,
      password: hashPassword(String(password)),
      phone,
      createdAt: new Date().toISOString(),
    };

    await writeDb((d) => {
      d.patients.push(patient);
    });

    return NextResponse.json({
      ok: true,
      role: "patient",
      user: publicPatient(patient),
      loginUrl: "/login/paciente",
    });
  }

  return NextResponse.json({ error: "Rol inválido" }, { status: 400 });
}

/** Listar médicos/pacientes (sin contraseñas) — solo admin. */
export async function GET(request: NextRequest) {
  const auth = assertAdmin(request);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const db = await readDb();
  return NextResponse.json({
    doctors: db.doctors.map((d) => ({
      id: d.id,
      fullName: d.fullName,
      email: d.email,
      mercadopagoConnected: !!d.payment?.mercadopagoUserId,
    })),
    patients: db.patients.map((p) => ({
      id: p.id,
      fullName: p.fullName,
      email: p.email,
    })),
  });
}

/**
 * Resetear contraseña o crear usuario si no existe.
 * PATCH { action: "upsert", role, email, password, fullName?, specialty?, licenseNumber? }
 */
export async function PATCH(request: NextRequest) {
  const auth = assertAdmin(request);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const body = await request.json();
  const { action, role, email, password, fullName, specialty, licenseNumber } =
    body;

  if (action !== "upsert" || !role || !email || !password) {
    return NextResponse.json(
      { error: "PATCH requiere action=upsert, role, email y password" },
      { status: 400 },
    );
  }

  const emailLower = String(email).toLowerCase().trim();
  const db = await readDb();

  if (role === "doctor") {
    const existing = db.doctors.find((d) => d.email === emailLower);
    if (existing) {
      await writeDb((d) => {
        const target = d.doctors.find((x) => x.email === emailLower);
        if (!target) return;
        target.password = hashPassword(String(password));
        if (fullName) target.fullName = String(fullName).trim();
        if (specialty) target.specialty = String(specialty);
        if (licenseNumber) target.licenseNumber = String(licenseNumber);
      });
      const updated = (await readDb()).doctors.find((d) => d.email === emailLower)!;
      return NextResponse.json({
        ok: true,
        action: "password_reset",
        user: publicDoctor(updated),
      });
    }

    if (!fullName) {
      return NextResponse.json(
        { error: "Usuario no encontrado. Enviá fullName para crearlo." },
        { status: 404 },
      );
    }

    const doctor = {
      id: newId("doc"),
      fullName: String(fullName).trim(),
      email: emailLower,
      password: hashPassword(String(password)),
      specialty: specialty || "Medicina General",
      licenseNumber: licenseNumber || "Pendiente",
      subscriptionStatus: "active" as const,
      subscriptionPlan: "trial",
      payment: {
        requirePaymentBeforeBooking: true,
        consultationFee: 100,
        currency: "ARS",
        mercadopagoEnabled: true,
      },
      createdAt: new Date().toISOString(),
    };

    await writeDb((d) => {
      d.doctors.push(doctor);
    });

    return NextResponse.json({
      ok: true,
      action: "created",
      user: publicDoctor(doctor),
      loginUrl: "/login/medico",
    });
  }

  if (role === "patient") {
    const existing = db.patients.find((p) => p.email === emailLower);
    if (existing) {
      await writeDb((d) => {
        const target = d.patients.find((x) => x.email === emailLower);
        if (!target) return;
        target.password = hashPassword(String(password));
        if (fullName) target.fullName = String(fullName).trim();
      });
      const updated = (await readDb()).patients.find((p) => p.email === emailLower)!;
      return NextResponse.json({
        ok: true,
        action: "password_reset",
        user: publicPatient(updated),
      });
    }

    if (!fullName) {
      return NextResponse.json(
        { error: "Usuario no encontrado. Enviá fullName para crearlo." },
        { status: 404 },
      );
    }

    const patient = {
      id: newId("pat"),
      fullName: String(fullName).trim(),
      email: emailLower,
      password: hashPassword(String(password)),
      createdAt: new Date().toISOString(),
    };

    await writeDb((d) => {
      d.patients.push(patient);
    });

    return NextResponse.json({
      ok: true,
      action: "created",
      user: publicPatient(patient),
      loginUrl: "/login/paciente",
    });
  }

  return NextResponse.json({ error: "Rol inválido" }, { status: 400 });
}
