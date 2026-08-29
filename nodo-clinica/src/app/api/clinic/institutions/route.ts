import { NextRequest, NextResponse } from "next/server";
import { requireAuth, resolveProfessional } from "@/lib/supabase/auth-guard";
import {
  createInstitution,
  getInstitutions,
} from "@/lib/clinic/db/institutions";
import { checkInstitutionScheduleConflict } from "@/lib/clinic/institution-schedule-conflict";
import type { DaySchedule } from "@/lib/clinic/schedule";

/** Lists the active institutions for the authenticated doctor. */
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

  const { data, error } = await getInstitutions(supabase, professional.id);
  if (error) {
    console.error("[institutions] list error:", error);
    return NextResponse.json(
      { error: "No se pudieron obtener las instituciones" },
      { status: 500 },
    );
  }

  return NextResponse.json({ institutions: data ?? [] });
}

/** Creates a new institution for the authenticated doctor. */
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

  const { name, city, address, extra_info, schedule } = await request.json();

  if (!name || !String(name).trim()) {
    return NextResponse.json(
      { error: "El nombre de la institución es requerido" },
      { status: 400 },
    );
  }

  const conflictError = await checkInstitutionScheduleConflict(
    supabase,
    professional.id,
    (schedule?.days ?? []) as DaySchedule[],
  );
  if (conflictError) {
    return NextResponse.json({ error: conflictError }, { status: 409 });
  }

  const { data, error } = await createInstitution(supabase, {
    org_id: user.org_id,
    professional_id: professional.id,
    name: String(name).trim(),
    city: city ? String(city).trim() : null,
    address: address ? String(address).trim() : null,
    extra_info: extra_info ? String(extra_info).trim() : null,
    schedule: schedule ?? { days: [] },
  });

  if (error || !data) {
    console.error("[institutions] create error:", error);
    return NextResponse.json(
      { error: "No se pudo crear la institución" },
      { status: 500 },
    );
  }

  return NextResponse.json({ institution: data });
}
