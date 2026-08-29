import { NextRequest, NextResponse } from "next/server";
import { requireAuth, resolveProfessional } from "@/lib/supabase/auth-guard";

export async function GET(request: NextRequest) {
  const authResult = await requireAuth(request);
  if (authResult instanceof NextResponse) return authResult;
  const { user, supabase } = authResult;

  if (user.role !== "doctor" && user.role !== "medico") {
    return NextResponse.json(
      { error: "Debe iniciar sesión como médico" },
      { status: 401 },
    );
  }

  const professional = await resolveProfessional(authResult);
  if (!professional?.id) {
    return NextResponse.json(
      { error: "Médico no encontrado" },
      { status: 404 },
    );
  }

  const { data, error } = await (supabase as any)
    .from("in_person_availability")
    .select("enabled, availability, location_info")
    .eq("professional_id", professional.id)
    .maybeSingle();

  if (error) {
    console.error("[in-person-availability] load error:", error);
    return NextResponse.json(
      { error: "No se pudo cargar la agenda presencial" },
      { status: 500 },
    );
  }

  return NextResponse.json({
    enabled: data?.enabled ?? false,
    availability: data?.availability ?? { slotDurationMinutes: 30, days: [] },
    location_info: data?.location_info ?? {},
  });
}

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

  const professional = await resolveProfessional(authResult);
  if (!professional?.id) {
    return NextResponse.json(
      { error: "Médico no encontrado" },
      { status: 404 },
    );
  }

  if (!user.org_id) {
    return NextResponse.json({ error: "org_id requerido" }, { status: 403 });
  }

  const { enabled, availability, location_info } = await request.json();

  // Days/times are no longer configured here — each institution owns its
  // own schedule (nodo_clinica.institutions.schedule, validated for
  // conflicts on its own save). This row only keeps the global on/off,
  // contact info, and slot duration shared across all institutions.
  const { data, error } = await (supabase as any)
    .from("in_person_availability")
    .upsert({
      professional_id: professional.id,
      org_id: user.org_id,
      enabled: enabled ?? false,
      availability: {
        slotDurationMinutes: availability?.slotDurationMinutes ?? 30,
        days: [],
      },
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
