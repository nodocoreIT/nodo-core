// @ts-nocheck
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/supabase/auth-guard";
import { randomUUID } from "crypto";

function filterMessages(
  messages: Array<{
    id: string;
    from_professional_id: string;
    from_professional_name: string;
    to_professional_id: string | null;
    content: string;
    created_at: string;
  }>,
  professionalId: string,
  peerId: string | null,
) {
  if (peerId) {
    return messages.filter(
      (m) =>
        (m.from_professional_id === professionalId && m.to_professional_id === peerId) ||
        (m.from_professional_id === peerId && m.to_professional_id === professionalId),
    );
  }
  return messages.filter((m) => m.to_professional_id === null);
}

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;
  const { user, supabase } = auth;

  if (user.role === "patient" || !user.org_id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  // Resolve professional row for this auth user
  const { data: me } = await supabase
    .from("professionals")
    .select("id, full_name")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (!me) {
    return NextResponse.json({ error: "Médico no encontrado" }, { status: 404 });
  }

  const peerId = new URL(request.url).searchParams.get("peerId");

  const { data: messages, error } = await supabase
    .from("interconsult_messages")
    .select("*")
    .eq("org_id", user.org_id)
    .order("created_at", { ascending: true });

  if (error) {
    return NextResponse.json({ error: "Error al obtener mensajes" }, { status: 500 });
  }

  type Msg = {
    id: string;
    from_professional_id: string;
    from_professional_name: string;
    to_professional_id: string | null;
    content: string;
    created_at: string;
  };

  const filtered = filterMessages((messages as Msg[]) ?? [], me.id, peerId);

  return NextResponse.json({ messages: filtered });
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;
  const { user, supabase } = auth;

  if (user.role === "patient" || !user.org_id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { data: me } = await supabase
    .from("professionals")
    .select("id, full_name")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (!me) {
    return NextResponse.json({ error: "Médico no encontrado" }, { status: 404 });
  }

  const body = await request.json();
  const content = String(body.content ?? "").trim();
  const toProfessionalId =
    body.toDoctorId === null || body.toDoctorId === undefined
      ? null
      : String(body.toDoctorId);

  if (!content) {
    return NextResponse.json({ error: "Mensaje vacío" }, { status: 400 });
  }

  // Validate toProfessionalId FK exists in professionals
  if (toProfessionalId) {
    const { data: peer } = await supabase
      .from("professionals")
      .select("id")
      .eq("id", toProfessionalId)
      .maybeSingle();

    if (!peer) {
      return NextResponse.json({ error: "Contacto no encontrado" }, { status: 422 });
    }
  }

  const now = new Date().toISOString();

  const { data: message, error: msgError } = await supabase
    .from("interconsult_messages")
    .insert({
      id: randomUUID(),
      org_id: user.org_id,
      from_professional_id: me.id,
      from_professional_name: me.full_name,
      to_professional_id: toProfessionalId,
      content,
      created_at: now,
    })
    .select()
    .single();

  if (msgError) {
    // Return 422 for FK violations
    if (msgError.code === "23503") {
      return NextResponse.json(
        { error: "ID de profesional inválido" },
        { status: 422 },
      );
    }
    return NextResponse.json({ error: "Error al enviar mensaje" }, { status: 500 });
  }

  // Update presence
  await supabase
    .from("doctor_presence")
    .upsert(
      { professional_id: me.id, org_id: user.org_id, last_seen: now },
      { onConflict: "professional_id,org_id" },
    );

  return NextResponse.json({ message });
}
