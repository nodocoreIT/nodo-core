import { NextRequest, NextResponse } from "next/server";
import { createServiceClient, createSharedServiceClient } from "@/lib/supabase/server";
import { assertOnboardingPhoneVerified } from "@/lib/clinic/phone-verification";
import { CLINIC_ORG_ID, syncClinicaAuthClaims } from "@/lib/clinic/clinic-org";

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json();
    const { fullName, specialty, licenseNumber, plan, token } = body as {
      fullName?: string;
      specialty?: string;
      licenseNumber?: string;
      plan?: string;
      token?: string;
    };

    if (!token) {
      return NextResponse.json(
        { error: "Token de onboarding requerido." },
        { status: 400 },
      );
    }

    if (!fullName || !specialty || !plan) {
      return NextResponse.json(
        { error: "Se requieren fullName, specialty y plan." },
        { status: 400 },
      );
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const serviceClient = (await createServiceClient()) as any;

    // Look up pending registration by onboarding_token
    const { data: pending, error: tokenError } = await serviceClient
      .from("pending_clinic_registrations")
      .select("id, email, verified_at")
      .eq("onboarding_token", token)
      .eq("role", "medico")
      .maybeSingle();

    if (tokenError || !pending) {
      return NextResponse.json(
        { error: "Token inválido o expirado." },
        { status: 400 },
      );
    }

    let verifiedPhone: string;
    try {
      verifiedPhone = await assertOnboardingPhoneVerified(token);
    } catch (e) {
      return NextResponse.json(
        { error: e instanceof Error ? e.message : "Celular no verificado." },
        { status: 400 },
      );
    }

    const email = pending.email as string;

    // Find auth user by email (admin-only, one-time onboarding operation)
    const { data: listData, error: listError } =
      await serviceClient.auth.admin.listUsers({ page: 1, perPage: 1000 });

    if (listError) {
      console.error("[onboarding/medico] listUsers error", listError);
      return NextResponse.json(
        { error: "Error al obtener usuario." },
        { status: 500 },
      );
    }

    const authUser = listData.users.find(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (u: any) => String(u.email ?? "").toLowerCase() === email.toLowerCase(),
    );
    if (!authUser) {
      return NextResponse.json(
        { error: "Usuario no encontrado. Reintentá el registro." },
        { status: 404 },
      );
    }

    const userId = authUser.id;

    // Insert into org_members (shared schema — ignore duplicate)
    const sharedClient = await createSharedServiceClient();
    const { error: orgError } = await sharedClient
      .from("org_members")
      .insert({ user_id: userId, org_id: CLINIC_ORG_ID, role: "admin" });

    if (orgError && orgError.code !== "23505") {
      console.error("[onboarding/medico] org_members insert error", orgError);
      return NextResponse.json(
        { error: "Error al registrar organización." },
        { status: 500 },
      );
    }

    // Split fullName into first/last for the DB columns
    const nameParts = fullName.trim().split(/\s+/);
    const firstName = nameParts[0];
    const lastName = nameParts.slice(1).join(" ") || firstName;

    // Insert into professionals (ignore duplicate — idempotent)
    const { error: profError } = await serviceClient
      .from("professionals")
      .insert({
        user_id: userId,
        org_id: CLINIC_ORG_ID,
        first_name: firstName,
        last_name: lastName,
        full_name: fullName,
        email: email.toLowerCase().trim(),
        phone: verifiedPhone,
        phone_verified_at: new Date().toISOString(),
        specialty,
        license_number: licenseNumber ?? null,
        subscription_status: "trial",
        subscription_plan: plan,
      });

    if (profError && profError.code !== "23505") {
      console.error("[onboarding/medico] professionals insert error", profError);
      return NextResponse.json(
        { error: "Error al crear perfil profesional." },
        { status: 500 },
      );
    }

    await syncClinicaAuthClaims(serviceClient, userId, "medico");

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
