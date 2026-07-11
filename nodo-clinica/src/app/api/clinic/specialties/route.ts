export const dynamic = "force-dynamic";

import { NextResponse, type NextRequest } from "next/server";
import { requireAuth } from "@/lib/supabase/auth-guard";
import { createClient, createServiceClient } from "@/lib/supabase/server";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function getReadClient(): Promise<any> {
  // Use the regular SSR client (same as all other working routes).
  // The medical_specialties table has RLS allowing anon SELECT on approved rows.
  return createClient();
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function getServiceClient(): Promise<any> {
  return createServiceClient();
}

const DOCTOR_ROLES = ["admin", "super_admin", "medico", "agent", "doctor"];

// GET /api/clinic/specialties
// Public — no auth required (used on registration page before login).
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim();

  const supabase = await getReadClient();

  let query = supabase
    .from("medical_specialties")
    .select("*")
    .eq("status", "approved")
    .order("name", { ascending: true });

  if (q) {
    query = query.ilike("name", `%${q}%`);
  }

  const { data, error } = await query;

  if (error) {
    console.error("[specialties] GET error", error);
    return NextResponse.json(
      { error: "Error al obtener las especialidades." },
      { status: 500 },
    );
  }

  return NextResponse.json({ specialties: data });
}

// POST /api/clinic/specialties
// Doctor only. Body: { name: string }
// Returns existing approved specialty or creates a pending one.
export async function POST(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  if (!DOCTOR_ROLES.includes(auth.user.role)) {
    return NextResponse.json(
      { error: "No tenés permisos para realizar esta acción." },
      { status: 403 },
    );
  }

  let body: { name?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "El cuerpo de la solicitud es inválido." }, { status: 400 });
  }

  const name = body.name?.trim();
  if (!name) {
    return NextResponse.json(
      { error: "El nombre de la especialidad es requerido." },
      { status: 400 },
    );
  }

  const supabase = await getServiceClient();

  // Check if an approved specialty with the same name already exists (case-insensitive)
  const { data: existing, error: searchError } = await supabase
    .from("medical_specialties")
    .select("*")
    .eq("status", "approved")
    .ilike("name", name)
    .maybeSingle();

  if (searchError) {
    console.error("[specialties] POST search error", searchError);
    return NextResponse.json(
      { error: "Error al verificar la especialidad." },
      { status: 500 },
    );
  }

  if (existing) {
    return NextResponse.json({ exists: true, specialty: existing });
  }

  // Insert as pending (service client bypasses RLS for insert)
  const { data: created, error: insertError } = await supabase
    .from("medical_specialties")
    .insert({ name, status: "pending" })
    .select()
    .single();

  if (insertError) {
    console.error("[specialties] POST insert error", insertError);
    return NextResponse.json(
      { error: "Error al crear la especialidad." },
      { status: 500 },
    );
  }

  return NextResponse.json({ created: true, specialty: created }, { status: 201 });
}
