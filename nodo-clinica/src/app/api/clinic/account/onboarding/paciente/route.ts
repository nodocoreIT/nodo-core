import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/supabase/auth-guard";

const CLINIC_ORG_ID =
  process.env.CLINIC_ORG_ID ?? "843524dc-0c3b-4340-bc8e-e3ae5aa00fd2";

function getExtension(filename: string): string {
  const parts = filename.split(".");
  return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : "jpg";
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  try {
    const formData = await request.formData();

    const fullName = formData.get("fullName") as string | null;
    const address = formData.get("address") as string | null;
    const obraSocial = formData.get("obraSocial") as string | null;
    const plan = formData.get("plan") as string | null;
    const dniFront = formData.get("dniFront") as File | null;
    const dniBack = formData.get("dniBack") as File | null;

    if (!fullName || !plan) {
      return NextResponse.json(
        { error: "Se requieren fullName y plan." },
        { status: 400 },
      );
    }

    const serviceClient = await createServiceClient();
    const userId = auth.user.id;
    const email = auth.user.email ?? "";

    let dniFrontPath: string | null = null;
    let dniBackPath: string | null = null;

    // Upload DNI files before inserting the patient row.
    // If any upload fails, return 500 without creating a partial record.
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

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const anyClient = serviceClient as any;

    // Insert patient record
    const { error: patientError } = await anyClient
      .from("patients")
      .insert({
        profile_id: userId,
        org_id: CLINIC_ORG_ID,
        full_name: fullName,
        email: email.toLowerCase().trim(),
        address: address ?? null,
        obra_social: obraSocial ?? null,
        subscription_plan: plan,
        dni_front_path: dniFrontPath,
        dni_back_path: dniBackPath,
      });

    if (patientError) {
      if (patientError.code === "23505") {
        return NextResponse.json(
          { error: "Onboarding already completed" },
          { status: 409 },
        );
      }
      console.error("[onboarding/paciente] patients insert error", patientError);
      return NextResponse.json(
        { error: "Error al crear perfil de paciente." },
        { status: 500 },
      );
    }

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
