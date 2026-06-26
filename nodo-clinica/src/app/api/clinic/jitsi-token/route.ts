// @ts-nocheck
import { NextRequest, NextResponse } from "next/server";
import { generateJaasJwt } from "@/lib/jitsi/generate-jaas-jwt";
import { isJaasConfigured } from "@/lib/jitsi/jaas-config";
import { requireAuth } from "@/lib/supabase/auth-guard";
import { createClient } from "@/lib/supabase/server";

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
  } else if (user?.role === "admin" || user?.role === "super_admin") {
    // Doctor: verify they own a matching appointment
    const { data: me } = await supabase
      .from("professionals")
      .select("id")
      .eq("auth_user_id", user.id)
      .maybeSingle();

    if (!me) {
      return NextResponse.json({ error: "No autorizado para esta sala" }, { status: 403 });
    }

    const { data: apt } = await supabase
      .from("appointments")
      .select("id")
      .eq("jitsi_room_id", room)
      .eq("doctor_id", me.id)
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
