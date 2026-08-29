import { NextRequest, NextResponse } from "next/server";
import { requireAuth, resolveProfessional } from "@/lib/supabase/auth-guard";
import {
  deactivateInstitution,
  updateInstitution,
} from "@/lib/clinic/db/institutions";
import { checkInstitutionScheduleConflict } from "@/lib/clinic/institution-schedule-conflict";
import type { DaySchedule } from "@/lib/clinic/schedule";

async function resolveOwnedInstitution(
  request: NextRequest,
  id: string,
) {
  const authResult = await requireAuth(request);
  if (authResult instanceof NextResponse) return { error: authResult };
  const { user, supabase } = authResult;

  if (user.role !== "doctor" && user.role !== "medico") {
    return {
      error: NextResponse.json(
        { error: "Debe iniciar sesión como médico" },
        { status: 401 },
      ),
    };
  }

  const professional = await resolveProfessional(authResult);
  if (!professional?.id) {
    return {
      error: NextResponse.json(
        { error: "Médico no encontrado" },
        { status: 404 },
      ),
    };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: existing, error: fetchError } = await (supabase as any)
    .from("institutions")
    .select("id, professional_id")
    .eq("id", id)
    .maybeSingle();

  if (fetchError || !existing) {
    return {
      error: NextResponse.json(
        { error: "Institución no encontrada" },
        { status: 404 },
      ),
    };
  }

  if ((existing as { professional_id: string }).professional_id !== professional.id) {
    return {
      error: NextResponse.json({ error: "No autorizado" }, { status: 403 }),
    };
  }

  return { supabase, professionalId: professional.id };
}

/** Updates an institution owned by the authenticated doctor. */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const resolved = await resolveOwnedInstitution(request, id);
  if ("error" in resolved) return resolved.error;
  const { supabase, professionalId } = resolved;

  const { name, city, address, extra_info, schedule } = await request.json();

  if (name !== undefined && !String(name).trim()) {
    return NextResponse.json(
      { error: "El nombre de la institución es requerido" },
      { status: 400 },
    );
  }

  if (schedule !== undefined) {
    const conflictError = await checkInstitutionScheduleConflict(
      supabase,
      professionalId,
      (schedule?.days ?? []) as DaySchedule[],
      id,
    );
    if (conflictError) {
      return NextResponse.json({ error: conflictError }, { status: 409 });
    }
  }

  const updates: Record<string, unknown> = {};
  if (name !== undefined) updates.name = String(name).trim();
  if (city !== undefined) updates.city = city ? String(city).trim() : null;
  if (address !== undefined)
    updates.address = address ? String(address).trim() : null;
  if (extra_info !== undefined)
    updates.extra_info = extra_info ? String(extra_info).trim() : null;
  if (schedule !== undefined) updates.schedule = schedule;

  const { data, error } = await updateInstitution(supabase, id, updates);
  if (error || !data) {
    console.error("[institutions] update error:", error);
    return NextResponse.json(
      { error: "No se pudo actualizar la institución" },
      { status: 500 },
    );
  }

  return NextResponse.json({ institution: data });
}

/** Soft-deletes (active = false) an institution owned by the authenticated doctor. */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const resolved = await resolveOwnedInstitution(request, id);
  if ("error" in resolved) return resolved.error;
  const { supabase } = resolved;

  const { data, error } = await deactivateInstitution(supabase, id);
  if (error || !data) {
    console.error("[institutions] deactivate error:", error);
    return NextResponse.json(
      { error: "No se pudo eliminar la institución" },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true });
}
