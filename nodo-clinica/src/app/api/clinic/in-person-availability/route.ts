import { NextRequest, NextResponse } from "next/server";
import { requireAuth, resolveProfessional } from "@/lib/supabase/auth-guard";
import { createServiceClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  const authResult = await requireAuth(request);
  if (authResult instanceof NextResponse) return authResult;
  const { user, supabase } = authResult;

  if (user.role !== "doctor" && user.role !== "medico") {
    return NextResponse.json(
      { error: "Debe iniciar sesión como médico" },
      { status: 401 },
    );
  }

  const professional = await resolveProfessional(user.id);
  if (!professional?.id) {
    return NextResponse.json(
      { error: "Médico no encontrado" },
      { status: 404 },
    );
  }

  const { enabled, availability, location_info } = await request.json();

  const { data, error } = await supabase
    .from("in_person_availability")
    .upsert({
      professional_id: professional.id,
      org_id: professional.org_id,
      enabled: enabled ?? false,
      availability: availability ?? { slotDurationMinutes: 30, days: [] },
      location_info: location_info ?? {},
      updated_at: new Date().toISOString(),
    })
    .select()
    .maybeSingle();

  if (error) {
    console.error("[in-person-availability] save error:", error);
    return NextResponse.json(
      { error: "No se pudo guardar la agenda presencial" },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true, data });
}
