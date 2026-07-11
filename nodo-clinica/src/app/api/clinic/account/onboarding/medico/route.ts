import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/supabase/auth-guard";

const CLINIC_ORG_ID =
  process.env.CLINIC_ORG_ID ?? "843524dc-0c3b-4340-bc8e-e3ae5aa00fd2";

export async function POST(request: NextRequest): Promise<NextResponse> {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  try {
    const body = await request.json();
    const { fullName, specialty, licenseNumber, plan } = body as {
      fullName?: string;
      specialty?: string;
      licenseNumber?: string;
      plan?: string;
    };

    if (!fullName || !specialty || !plan) {
      return NextResponse.json(
        { error: "Se requieren fullName, specialty y plan." },
        { status: 400 },
      );
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const serviceClient = (await createServiceClient()) as any;
    const userId = auth.user.id;
    const email = auth.user.email ?? "";

    // Insert into org_members (shared schema)
    const { error: orgError } = await serviceClient
      .from("org_members")
      .insert({ user_id: userId, org_id: CLINIC_ORG_ID, role: "admin" });

    if (orgError) {
      if (orgError.code === "23505") {
        return NextResponse.json(
          { error: "Onboarding already completed" },
          { status: 409 },
        );
      }
      console.error("[onboarding/medico] org_members insert error", orgError);
      return NextResponse.json(
        { error: "Error al registrar organización." },
        { status: 500 },
      );
    }

    // Insert into professionals
    const { error: profError } = await serviceClient
      .from("professionals")
      .insert({
        user_id: userId,
        org_id: CLINIC_ORG_ID,
        full_name: fullName,
        email: email.toLowerCase().trim(),
        specialty,
        license_number: licenseNumber ?? null,
        subscription_status: "trial",
        subscription_plan: plan,
      });

    if (profError) {
      if (profError.code === "23505") {
        return NextResponse.json(
          { error: "Onboarding already completed" },
          { status: 409 },
        );
      }
      console.error("[onboarding/medico] professionals insert error", profError);
      return NextResponse.json(
        { error: "Error al crear perfil profesional." },
        { status: 500 },
      );
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[onboarding/medico]", err);
    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? err.message
            : "Error en onboarding. Reintentá.",
      },
      { status: 500 },
    );
  }
}
