export const dynamic = "force-dynamic";

import { NextResponse, type NextRequest } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function getReadClient(): Promise<any> {
  return createClient();
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function getServiceClient(): Promise<any> {
  return createServiceClient();
}

// GET /api/clinic/obras-sociales
// Public — no auth required (used on patient onboarding page before login).
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim();

  const supabase = await getReadClient();

  let query = supabase
    .from("obras_sociales")
    .select("id, name")
    .eq("status", "approved")
    .order("name", { ascending: true })
    .limit(50);

  if (q) {
    query = query.ilike("name", `%${q}%`);
  }

  const { data, error } = await query;

  if (error) {
    console.error("[obras-sociales] GET error", error);
    return NextResponse.json(
      { error: "Error al obtener las obras sociales." },
      { status: 500 },
    );
  }

  return NextResponse.json({ obrasSociales: data });
}

// POST /api/clinic/obras-sociales
// Public — called from patient onboarding (unauthenticated).
// Creates a pending entry if it doesn't exist.
export async function POST(request: NextRequest) {
  let body: { name?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "El cuerpo de la solicitud es inválido." }, { status: 400 });
  }

  const name = body.name?.trim();
  if (!name) {
    return NextResponse.json(
      { error: "El nombre de la obra social es requerido." },
      { status: 400 },
    );
  }

  const supabase = await getServiceClient();

  // Return existing approved entry if it matches (case-insensitive)
  const { data: existing } = await supabase
    .from("obras_sociales")
    .select("id, name")
    .eq("status", "approved")
    .ilike("name", name)
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ exists: true, obraSocial: existing });
  }

  // Insert as pending
  const { data: created, error: insertError } = await supabase
    .from("obras_sociales")
    .insert({ name, status: "pending" })
    .select("id, name")
    .single();

  if (insertError) {
    console.error("[obras-sociales] POST insert error", insertError);
    return NextResponse.json(
      { error: "Error al guardar la obra social." },
      { status: 500 },
    );
  }

  return NextResponse.json({ created: true, obraSocial: created }, { status: 201 });
}
