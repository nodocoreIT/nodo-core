import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";

async function registerDoctor(body: {
  fullName: string;
  email: string;
  password: string;
  specialty?: string;
  licenseNumber?: string;
  orgId: string;
}): Promise<NextResponse> {
  const supabase = await createClient();
  const serviceClient = await createServiceClient();

  const { data, error } = await supabase.auth.signUp({
    email: body.email,
    password: body.password,
    options: { data: { full_name: body.fullName } },
  });

  if (error || !data.user) {
    if (error?.message?.toLowerCase().includes("already registered")) {
      return NextResponse.json({ error: "Email ya registrado" }, { status: 409 });
    }
    return NextResponse.json(
      { error: error?.message ?? "Error al crear cuenta" },
      { status: 400 },
    );
  }

  const userId = data.user.id;

  const { error: orgMemberError } = await serviceClient
    .schema("shared" as never)
    .from("org_members")
    .insert({ profile_id: userId, org_id: body.orgId, role: "admin" });

  if (orgMemberError) {
    console.error("[register/doctor] org_members insert error", orgMemberError);
    return NextResponse.json({ error: "Error al registrar miembro de organización" }, { status: 500 });
  }

  const { error: profError } = await serviceClient
    .from("professionals")
    .insert({
      user_id: userId,
      org_id: body.orgId,
      full_name: body.fullName,
      specialty: body.specialty ?? "Medicina General",
      license_number: body.licenseNumber ?? "Pendiente",
    });

  if (profError) {
    console.error("[register/doctor] professionals insert error", profError);
    return NextResponse.json({ error: "Error al crear perfil profesional" }, { status: 500 });
  }

  return NextResponse.json({
    user: { id: userId, email: data.user.email, role: "admin" },
    role: "admin",
  });
}

async function registerPatient(body: {
  fullName: string;
  email: string;
  password: string;
  phone?: string;
  orgId: string;
}): Promise<NextResponse> {
  const supabase = await createClient();
  const serviceClient = await createServiceClient();

  const { data, error } = await supabase.auth.signUp({
    email: body.email,
    password: body.password,
    options: { data: { full_name: body.fullName } },
  });

  if (error || !data.user) {
    if (error?.message?.toLowerCase().includes("already registered")) {
      return NextResponse.json({ error: "Este email ya está registrado como paciente" }, { status: 409 });
    }
    return NextResponse.json(
      { error: error?.message ?? "Error al crear cuenta" },
      { status: 400 },
    );
  }

  const userId = data.user.id;

  const { error: patientError } = await serviceClient.from("patients").insert({
    profile_id: userId,
    org_id: body.orgId,
    full_name: body.fullName,
    email: body.email.toLowerCase().trim(),
    phone: body.phone ?? null,
  });

  if (patientError) {
    console.error("[register/patient] patients insert error", patientError);
    return NextResponse.json({ error: "Error al crear perfil de paciente" }, { status: 500 });
  }

  // No org_members row for patients — patient JWT has no org_id claim
  return NextResponse.json({
    user: { id: userId, email: data.user.email, role: "patient" },
    role: "patient",
  });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { role, fullName, email, password } = body;

    if (!role || !fullName || !email || !password) {
      return NextResponse.json({ error: "Datos incompletos" }, { status: 400 });
    }

    if (!body.orgId) {
      return NextResponse.json({ error: "org_id requerido" }, { status: 400 });
    }

    if (role === "doctor") {
      return await registerDoctor(body);
    }
    if (role === "patient") {
      return await registerPatient(body);
    }

    return NextResponse.json({ error: "Rol inválido" }, { status: 400 });
  } catch (err) {
    console.error("[register]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error al registrar. Reintentá." },
      { status: 500 },
    );
  }
}
