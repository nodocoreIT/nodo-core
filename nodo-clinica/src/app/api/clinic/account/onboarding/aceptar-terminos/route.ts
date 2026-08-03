import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { extractClientIp, isValidIp } from "@/lib/clinic/request-ip";
import { TERMS_CONTENT, TERMS_VERSION } from "@/lib/clinic/terms-content";

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json();
    const { token, role } = body as { token?: string; role?: string };

    if (!token || (role !== "medico" && role !== "paciente")) {
      return NextResponse.json(
        { error: "Token y rol de onboarding requeridos." },
        { status: 400 },
      );
    }

    const clientIp = extractClientIp(request);
    if (!clientIp || !isValidIp(clientIp)) {
      return NextResponse.json(
        {
          error:
            "No se pudo detectar tu dirección IP. No podés continuar con el registro hasta que sea visible.",
        },
        { status: 400 },
      );
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const serviceClient = (await createServiceClient()) as any;

    const { data: pending, error: tokenError } = await serviceClient
      .from("pending_clinic_registrations")
      .select("id, email")
      .eq("onboarding_token", token)
      .eq("role", role)
      .maybeSingle();

    if (tokenError || !pending) {
      return NextResponse.json(
        { error: "Token inválido o expirado." },
        { status: 400 },
      );
    }

    const email = pending.email as string;

    const { data: listData, error: listError } =
      await serviceClient.auth.admin.listUsers({ page: 1, perPage: 1000 });

    if (listError) {
      console.error("[aceptar-terminos] listUsers error", listError);
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

    const { error: insertError } = await serviceClient
      .from("terms_acceptances")
      .upsert(
        {
          pending_registration_id: pending.id,
          user_id: authUser.id,
          role,
          terms_version: TERMS_VERSION,
          terms_content: TERMS_CONTENT,
          ip_address: clientIp,
        },
        { onConflict: "pending_registration_id", ignoreDuplicates: true },
      );

    if (insertError) {
      console.error("[aceptar-terminos] insert error", insertError);
      return NextResponse.json(
        { error: "Error al registrar la aceptación de términos." },
        { status: 500 },
      );
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[aceptar-terminos]", err);
    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? err.message
            : "Error al aceptar términos. Reintentá.",
      },
      { status: 500 },
    );
  }
}
