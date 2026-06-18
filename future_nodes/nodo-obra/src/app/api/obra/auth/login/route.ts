import { NextRequest, NextResponse } from "next/server";
import { readDb, publicStaff, publicCliente } from "@/lib/obra/local-db";
import {
  jsonWithSession,
  clearSessionResponse,
  getSessionFromRequest,
  type ObraSession,
} from "@/lib/obra/session";

export async function POST(request: NextRequest) {
  const { email, password, role = "staff" } = await request.json();

  if (!email || !password) {
    return NextResponse.json(
      { error: "Email y contraseña requeridos" },
      { status: 400 },
    );
  }

  const db = await readDb();
  const emailLower = String(email).toLowerCase().trim();

  if (role === "staff") {
    const staff = db.staff.find(
      (s) => s.email === emailLower && s.password === password,
    );
    if (!staff) {
      return NextResponse.json(
        { error: "Credenciales incorrectas" },
        { status: 401 },
      );
    }
    const session: ObraSession = {
      userId: staff.id,
      role: "staff",
      email: staff.email,
      fullName: staff.fullName,
    };
    return jsonWithSession(
      { user: publicStaff(staff), role: "staff", session },
      session,
    );
  }

  if (role === "cliente") {
    const cliente = db.clientes.find(
      (c) =>
        c.portalEmail.toLowerCase() === emailLower &&
        c.portalPassword === password &&
        c.puedeVerPortal,
    );
    if (!cliente) {
      return NextResponse.json(
        { error: "Credenciales incorrectas" },
        { status: 401 },
      );
    }
    const session: ObraSession = {
      userId: cliente.id,
      role: "cliente",
      email: cliente.portalEmail,
      fullName: cliente.nombre,
    };
    return jsonWithSession(
      { user: publicCliente(cliente), role: "cliente", session },
      session,
    );
  }

  return NextResponse.json({ error: "Rol inválido" }, { status: 400 });
}

export async function GET(request: NextRequest) {
  const session = await getSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ session: null, user: null });
  }

  const db = await readDb();
  if (session.role === "staff") {
    const staff = db.staff.find((s) => s.id === session.userId);
    if (!staff) return NextResponse.json({ session: null, user: null });
    return NextResponse.json({
      session,
      user: publicStaff(staff),
      role: "staff",
    });
  }

  const cliente = db.clientes.find((c) => c.id === session.userId);
  if (!cliente) return NextResponse.json({ session: null, user: null });
  return NextResponse.json({
    session,
    user: publicCliente(cliente),
    role: "cliente",
  });
}

export async function DELETE() {
  return clearSessionResponse();
}
