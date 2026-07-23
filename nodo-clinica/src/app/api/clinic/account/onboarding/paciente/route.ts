import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { assertOnboardingPhoneVerified } from "@/lib/clinic/phone-verification";
import { CLINIC_ORG_ID, syncClinicaAuthClaims } from "@/lib/clinic/clinic-org";

function getExtension(filename: string): string {
  const parts = filename.split(".");
  return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : "jpg";
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const formData = await request.formData();

    const token = formData.get("token") as string | null;
    const fullName = formData.get("fullName") as string | null;
    const dni = formData.get("dni") as string | null;
    const address = formData.get("address") as string | null;
    const obraSocial = formData.get("obraSocial") as string | null;
    const plan = formData.get("plan") as string | null;
    const dniFront = formData.get("dniFront") as File | null;
    const dniBack = formData.get("dniBack") as File | null;
    const skipPhoneVerification =
      formData.get("skipPhoneVerification") === "1" ||
      formData.get("skipPhoneVerification") === "true";

    if (!token) {
      return NextResponse.json(
        { error: "Token de onboarding requerido." },
        { status: 400 },
      );
    }

    if (!fullName || !plan || !dni) {
      return NextResponse.json(
        { error: "Se requieren fullName, dni y plan." },
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
      .eq("role", "paciente")
      .maybeSingle();

    if (tokenError || !pending) {
      return NextResponse.json(
        { error: "Token inválido o expirado." },
        { status: 400 },
      );
    }

    let verifiedPhone: string | null = null;
    if (!skipPhoneVerification) {
      try {
        verifiedPhone = await assertOnboardingPhoneVerified(token);
      } catch (e) {
        return NextResponse.json(
          { error: e instanceof Error ? e.message : "Celular no verificado." },
          { status: 400 },
        );
      }
    }

    const email = pending.email as string;

    // Find auth user by email (admin-only, one-time onboarding operation)
    const { data: listData, error: listError } =
      await serviceClient.auth.admin.listUsers({ page: 1, perPage: 1000 });

    if (listError) {
      console.error("[onboarding/paciente] listUsers error", listError);
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

    let dniFrontPath: string | null = null;
    let dniBackPath: string | null = null;

    // Upload DNI files before inserting the patient row
    if (dniFront && dniFront.size > 0) {
      const ext = getExtension(dniFront.name);
      const storagePath = `${userId}/dni_front.${ext}`;
      const buffer = await dniFront.arrayBuffer();

      const { error: uploadError } = await serviceClient.storage
        .from("clinic-registration-docs")
        .upload(storagePath, buffer, {
          contentType: dniFront.type || "image/jpeg",
          upsert: true,
        });

      if (uploadError) {
        console.error("[onboarding/paciente] DNI front upload error", uploadError);
        return NextResponse.json(
          { error: "Error al subir DNI frente. Reintentá." },
          { status: 500 },
        );
      }

      dniFrontPath = storagePath;
    }

    if (dniBack && dniBack.size > 0) {
      const ext = getExtension(dniBack.name);
      const storagePath = `${userId}/dni_back.${ext}`;
      const buffer = await dniBack.arrayBuffer();

      const { error: uploadError } = await serviceClient.storage
        .from("clinic-registration-docs")
        .upload(storagePath, buffer, {
          contentType: dniBack.type || "image/jpeg",
          upsert: true,
        });

      if (uploadError) {
        console.error("[onboarding/paciente] DNI back upload error", uploadError);
        return NextResponse.json(
          { error: "Error al subir DNI dorso. Reintentá." },
          { status: 500 },
        );
      }

      dniBackPath = storagePath;
    }

    // Split fullName into first/last for the DB columns
    const nameParts = (fullName ?? "").trim().split(/\s+/);
    const firstName = nameParts[0] ?? "";
    const lastName = nameParts.slice(1).join(" ") || firstName;

    // Insert patient record (ignore duplicate — idempotent)
    const { error: patientError } = await serviceClient
      .from("patients")
      .insert({
        profile_id: userId,
        org_id: CLINIC_ORG_ID,
        first_name: firstName,
        last_name: lastName,
        full_name: fullName,
        dni: dni.trim(),
        email: email.toLowerCase().trim(),
        phone: verifiedPhone,
        phone_verified_at: verifiedPhone ? new Date().toISOString() : null,
        address: address ?? null,
        obra_social: obraSocial ?? null,
        subscription_plan: plan,
        dni_front_path: dniFrontPath,
        dni_back_path: dniBackPath,
      });

    if (patientError && patientError.code !== "23505") {
      console.error("[onboarding/paciente] patients insert error", patientError);
      return NextResponse.json(
        { error: "Error al crear perfil de paciente." },
        { status: 500 },
      );
    }

    await syncClinicaAuthClaims(serviceClient, userId, "paciente");

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[onboarding/paciente]", err);
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
