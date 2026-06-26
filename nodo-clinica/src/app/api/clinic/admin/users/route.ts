// @ts-nocheck
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/supabase/auth-guard";
import { createServiceClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * Admin user management — requires role = 'super_admin' from JWT claims.
 * No request-body or header secret; role is verified from Supabase JWT app_metadata.
 */

function requireSuperAdmin(role: string): NextResponse | null {
  if (role !== "super_admin") {
    return NextResponse.json({ error: "Acceso denegado — se requiere super_admin" }, { status: 403 });
  }
  return null;
}

/** List users in the org. */
export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  const forbidden = requireSuperAdmin(auth.user.role);
  if (forbidden) return forbidden;

  if (!auth.user.org_id) {
    return NextResponse.json({ error: "Org no encontrada" }, { status: 403 });
  }

  const supabase = await createServiceClient();

  const { data: professionals } = await supabase
    .from("professionals")
    .select("id, full_name, email, specialty, auth_user_id")
    .eq("org_id", auth.user.org_id) as any;

  const { data: patients } = await supabase
    .from("patients")
    .select("*")
    .eq("org_id", auth.user.org_id) as any;

  return NextResponse.json({
    doctors: ((professionals as any) ?? []).map((p: any) => ({
      id: p.id,
      fullName: p.full_name,
      email: p.email,
      specialty: p.specialty,
    })),
    patients: ((patients as any) ?? []).map((p: any) => ({
      id: p.id,
      fullName: p.full_name || "",
      email: p.email || "",
    })),
  });
}

/**
 * Create a new doctor or patient user.
 * POST { role: "doctor"|"patient", fullName, email, password, specialty?, licenseNumber?, phone? }
 */
export async function POST(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  const forbidden = requireSuperAdmin(auth.user.role);
  if (forbidden) return forbidden;

  if (!auth.user.org_id) {
    return NextResponse.json({ error: "Org no encontrada" }, { status: 403 });
  }

  const body = await request.json();
  const { role, fullName, email, password, specialty, licenseNumber, phone } = body;

  if (!role || !fullName || !email || !password) {
    return NextResponse.json({ error: "Datos incompletos" }, { status: 400 });
  }

  const supabase = await createServiceClient();
  const emailLower = String(email).toLowerCase().trim();

  // Create auth user
  const { data: authData, error: signUpError } = await supabase.auth.admin.createUser({
    email: emailLower,
    password: String(password),
    email_confirm: true,
  });

  if (signUpError) {
    if (signUpError.message?.includes("already")) {
      return NextResponse.json({ error: "Email ya registrado" }, { status: 409 });
    }
    return NextResponse.json({ error: signUpError.message }, { status: 400 });
  }

  const authUserId = authData.user.id;

  if (role === "doctor") {
    const { data: professional, error: profError } = await (supabase
      .from("professionals")
      .insert({
        auth_user_id: authUserId,
        org_id: auth.user.org_id,
        full_name: String(fullName).trim(),
        email: emailLower,
        specialty: specialty || "Medicina General",
        license_number: licenseNumber || "Pendiente",
      })
      .select()
      .single() as any);

    if (profError) {
      return NextResponse.json({ error: profError.message }, { status: 400 });
    }

    // Add to org_members with admin role
    await (supabase.from("org_members").insert({
      user_id: authUserId,
      org_id: auth.user.org_id,
      role: "admin",
    }).select() as any);

    return NextResponse.json({
      ok: true,
      role: "doctor",
      user: { id: professional.id, fullName: professional.full_name, email: professional.email },
      loginUrl: "/login/medico",
    });
  }

  if (role === "patient") {
    const { data: patient, error: patError } = await (supabase
      .from("patients")
      .insert({
        profile_id: authUserId,
        org_id: auth.user.org_id,
        full_name: String(fullName).trim(),
        email: emailLower,
        phone: phone ?? null,
      } as any)
      .select()
      .single() as any);

    if (patError) {
      return NextResponse.json({ error: patError.message }, { status: 400 });
    }

    return NextResponse.json({
      ok: true,
      role: "patient",
      user: { id: (patient as any).id, fullName: (patient as any).full_name, email: (patient as any).email },
      loginUrl: "/login/paciente",
    });
  }

  return NextResponse.json({ error: "Rol inválido" }, { status: 400 });
}
