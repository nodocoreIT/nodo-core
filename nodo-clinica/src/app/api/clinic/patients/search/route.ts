import { NextRequest, NextResponse } from "next/server";
import { requireAuth, resolveProfessional } from "@/lib/supabase/auth-guard";
import { createServiceClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const authResult = await requireAuth(request);
  if (authResult instanceof NextResponse) return authResult;
  const { user } = authResult;

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

  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q");

  if (!query || !query.trim()) {
    return NextResponse.json([]);
  }

  const supabase = await createServiceClient();
  const q = query.trim().toLowerCase();

  // Get all patients for this doctor's org
  const { data: patients, error } = await (supabase as any)
    .from("patients")
    .select("id, full_name, email, dni, updated_at")
    .eq("org_id", user.org_id)
    .order("updated_at", { ascending: false });

  if (error) {
    console.error("[patients/search] query error:", error);
    return NextResponse.json(
      { error: "Error al buscar pacientes" },
      { status: 500 },
    );
  }

  // Filter by name, email, or DNI (client-side filtering for RLS safety)
  const filtered = (patients ?? []).filter((p: { full_name: string | null; email: string | null; dni: string | null }) => {
    const name = (p.full_name ?? "").toLowerCase();
    const email = (p.email ?? "").toLowerCase();
    const dni = (p.dni ?? "").toLowerCase();

    return (
      name.includes(q) ||
      email.includes(q) ||
      dni === q
    );
  });

  return NextResponse.json(
    filtered.map((p: { id: string; full_name: string | null; email: string | null; dni: string | null; updated_at: string }) => ({
      id: p.id,
      fullName: p.full_name,
      email: p.email,
      dni: p.dni,
      lastAppointmentAt: p.updated_at,
    }))
  );
}
