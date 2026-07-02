import { NextRequest, NextResponse } from "next/server";
import { generateJaasJwt } from "@/lib/jitsi/generate-jaas-jwt";
import { isJaasConfigured } from "@/lib/jitsi/jaas-config";
import { getSessionFromRequest } from "@/lib/clinic/session";
import { readDb } from "@/lib/clinic/local-db";

export const dynamic = "force-dynamic";

/** Token JWT para videollamada JaaS (sin límite de 5 min de meet.jit.si). */
export async function GET(request: NextRequest) {
  if (!isJaasConfigured()) {
    return NextResponse.json(
      { error: "JaaS no configurado en el servidor" },
      { status: 503 },
    );
  }

  const { searchParams } = new URL(request.url);
  const room = searchParams.get("room");
  const displayName = searchParams.get("displayName") ?? "Participante";
  const accessToken = searchParams.get("accessToken");
  const moderator = searchParams.get("moderator") === "true";

  if (!room) {
    return NextResponse.json({ error: "room requerido" }, { status: 400 });
  }

  const session = await getSessionFromRequest(request);
  const db = await readDb();

  if (accessToken) {
    const apt = db.appointments.find((a) => a.accessToken === accessToken);
    if (!apt) {
      return NextResponse.json({ error: "Turno no encontrado" }, { status: 404 });
    }
    if (apt.jitsiRoomId !== room && !room.endsWith(apt.jitsiRoomId)) {
      return NextResponse.json({ error: "Sala no válida" }, { status: 403 });
    }
  } else if (session?.role === "doctor") {
    const apt = db.appointments.find(
      (a) => a.jitsiRoomId === room && a.doctorId === session.userId,
    );
    if (!apt) {
      return NextResponse.json({ error: "No autorizado para esta sala" }, { status: 403 });
    }
  } else if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    const token = await generateJaasJwt({
      room,
      displayName,
      moderator,
      userId: session?.userId,
      email: session?.role === "doctor"
        ? db.doctors.find((d) => d.id === session.userId)?.email
        : session?.role === "patient"
          ? db.patients.find((p) => p.id === session.userId)?.email
          : undefined,
    });

    return NextResponse.json(token);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error al generar token";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
