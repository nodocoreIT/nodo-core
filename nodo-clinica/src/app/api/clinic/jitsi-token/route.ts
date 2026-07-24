import { NextRequest, NextResponse } from "next/server";
import { generateJaasJwt } from "@/lib/jitsi/generate-jaas-jwt";
import { isJaasConfigured } from "@/lib/jitsi/jaas-config";
import { requireAuth } from "@/lib/supabase/auth-guard";
import { createClient } from "@/lib/supabase/server";
import { isLocalMode } from "@/lib/clinic/config";
import { readDb } from "@/lib/clinic/local-db";
import { getSessionFromRequest } from "@/lib/clinic/session";

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
  const accessTokenParam = searchParams.get("accessToken");
  const moderator = searchParams.get("moderator") === "true";

  if (!room) {
    return NextResponse.json({ error: "room requerido" }, { status: 400 });
  }

  if (isLocalMode()) {
    const session = await getSessionFromRequest(request);
    const db = await readDb();

    if (accessTokenParam) {
      const apt = db.appointments.find((a) => a.accessToken === accessTokenParam);
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
        return NextResponse.json(
          { error: "No autorizado para esta sala" },
          { status: 403 },
        );
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
        email: session?.email,
      });
      return NextResponse.json(token);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Error al generar token";
      return NextResponse.json({ error: message }, { status: 500 });
    }
  }

  const auth = await requireAuth(request);
  const supabase = auth instanceof NextResponse ? await createClient() : auth.supabase;
  const user = auth instanceof NextResponse ? null : auth.user;

  if (accessTokenParam) {
    // Patient waiting room: validate via access_token on appointment
    const { data: apt } = await supabase
      .from("appointments")
      .select("id, jitsi_room_id, access_token")
      .eq("access_token", accessTokenParam)
      .maybeSingle();

    if (!apt) {
      return NextResponse.json({ error: "Turno no encontrado" }, { status: 404 });
    }

    const aptRow = apt as Record<string, unknown>;
    const jitsiRoom = aptRow.jitsi_room_id as string;
    if (jitsiRoom !== room && !room.endsWith(jitsiRoom)) {
      return NextResponse.json({ error: "Sala no válida" }, { status: 403 });
    }
  } else if (user?.role === "admin" || user?.role === "super_admin" || user?.role === "doctor") {
    // Doctor: verify they own a matching appointment
    const doctorId =
      auth instanceof NextResponse ? null : auth._professionalId ?? user.id;

    let meId = doctorId;
    if (!meId || user.role === "admin" || user.role === "super_admin") {
      const { data: me } = await supabase
        .from("professionals")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();
      meId = me?.id ?? meId;
    }

    if (!meId) {
      return NextResponse.json({ error: "No autorizado para esta sala" }, { status: 403 });
    }

    const { data: apt } = await supabase
      .from("appointments")
      .select("id")
      .eq("jitsi_room_id", room)
      .eq("doctor_id", meId)
      .maybeSingle();

    if (!apt) {
      return NextResponse.json({ error: "No autorizado para esta sala" }, { status: 403 });
    }
  } else if (!user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    const token = await generateJaasJwt({
      room,
      displayName,
      moderator,
      userId: user?.id,
      email: user?.email,
    });

    return NextResponse.json(token);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error al generar token";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
