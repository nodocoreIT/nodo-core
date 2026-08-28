import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/supabase/auth-guard";
import { createServiceClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * Marks a receta as "viewed" (first download) for the patient-portal sidebar
 * badge count — see `/api/clinic/patient-prescriptions/unread-count`. Called
 * fire-and-forget from `recetas-library.tsx` right when the patient clicks
 * "Descargar". Idempotent: repeat calls just overwrite `viewed_at` with a
 * newer timestamp, never throws if already viewed.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const authResult = await requireAuth(request);
  if (authResult instanceof NextResponse) return authResult;
  const { user, supabase } = authResult;

  if (user.role !== "patient") {
    return NextResponse.json(
      { error: "Debe iniciar sesión como paciente" },
      { status: 401 },
    );
  }

  let source: "standalone" | "consultation" | undefined;
  try {
    const body = await request.json();
    source = body?.source;
  } catch {
    /* body may be empty; validated below */
  }

  if (source !== "standalone" && source !== "consultation") {
    return NextResponse.json({ error: "source inválido" }, { status: 400 });
  }

  const { data: patientRow } = await supabase
    .from("patients")
    .select("id")
    .eq("profile_id", user.id)
    .maybeSingle();

  if (!patientRow?.id) {
    return NextResponse.json({ error: "Paciente no encontrado" }, { status: 404 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const svc = (await createServiceClient()) as any;

  if (source === "standalone") {
    await svc
      .from("prescriptions")
      .update({ viewed_at: new Date().toISOString() })
      .eq("id", id)
      .eq("patient_id", patientRow.id);
  } else {
    await svc
      .from("clinical_records")
      .update({ viewed_at: new Date().toISOString() })
      .eq("id", id)
      .eq("patient_id", patientRow.id)
      .eq("record_type", "receta");
  }

  return NextResponse.json({ ok: true });
}
