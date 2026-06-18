import { NextRequest, NextResponse } from "next/server";
import { readDb, writeDb, publicStaff } from "@/lib/obra/local-db";
import {
  jsonWithSession,
  requireStaffSession,
  type ObraSession,
} from "@/lib/obra/session";

export async function GET(request: NextRequest) {
  const session = await requireStaffSession(request);
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const db = await readDb();
  const staff = db.staff.find((s) => s.id === session.userId);
  if (!staff) {
    return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
  }

  return NextResponse.json({ user: publicStaff(staff) });
}

export async function PATCH(request: NextRequest) {
  const session = await requireStaffSession(request);
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const body = await request.json();
  const db = await readDb();
  const idx = db.staff.findIndex((s) => s.id === session.userId);
  if (idx < 0) {
    return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
  }

  const staff = db.staff[idx];
  const fullName =
    typeof body.fullName === "string" ? body.fullName.trim() : staff.fullName;
  const email =
    typeof body.email === "string"
      ? body.email.toLowerCase().trim()
      : staff.email;

  if (!fullName || !email) {
    return NextResponse.json(
      { error: "Nombre y email son obligatorios" },
      { status: 400 },
    );
  }

  const emailTaken = db.staff.some(
    (s) => s.id !== staff.id && s.email === email,
  );
  if (emailTaken) {
    return NextResponse.json({ error: "Ese email ya está en uso" }, { status: 409 });
  }

  if (body.newPassword) {
    const currentPassword = body.currentPassword ?? "";
    if (staff.password !== currentPassword) {
      return NextResponse.json(
        { error: "La contraseña actual no es correcta" },
        { status: 400 },
      );
    }
    if (String(body.newPassword).length < 6) {
      return NextResponse.json(
        { error: "La nueva contraseña debe tener al menos 6 caracteres" },
        { status: 400 },
      );
    }
    staff.password = String(body.newPassword);
  }

  staff.fullName = fullName;
  staff.email = email;
  db.staff[idx] = staff;
  await writeDb(db);

  const newSession: ObraSession = {
    userId: staff.id,
    role: "staff",
    email: staff.email,
    fullName: staff.fullName,
  };

  return jsonWithSession({ user: publicStaff(staff) }, newSession);
}
