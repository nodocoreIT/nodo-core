// @ts-nocheck
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/supabase/auth-guard";
import { getNotes, createNote } from "@/lib/clinic/db/clinical-records";

export async function GET(request: NextRequest) {
  const appointmentId = new URL(request.url).searchParams.get("appointmentId");
  if (!appointmentId) {
    return NextResponse.json(
      { error: "appointmentId requerido" },
      { status: 400 },
    );
  }

  const authResult = await requireAuth(request);
  if (authResult instanceof NextResponse) return authResult;
  const { supabase } = authResult;

  const { data: note } = await getNotes(supabase, appointmentId);
  return NextResponse.json(note ?? { content: "" });
}

export async function PUT(request: NextRequest) {
  const authResult = await requireAuth(request);
  if (authResult instanceof NextResponse) return authResult;
  const { user, supabase } = authResult;

  const { appointmentId, doctorId, content } = await request.json();

  if (!user.org_id) {
    return NextResponse.json({ error: "org_id requerido" }, { status: 403 });
  }

  await createNote(supabase, {
    appointment_id: appointmentId,
    org_id: user.org_id,
    doctor_id: doctorId,
    content,
  });

  return NextResponse.json({ ok: true });
}
