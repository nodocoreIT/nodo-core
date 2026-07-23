import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { isMailConfigured, sendPasswordResetEmail } from "@/lib/mail";
import { resolveAppOrigin } from "@/lib/clinic/appointment-payment";
import {
  buildPasswordRecoveryRedirect,
  parseClinicDbRole,
} from "@/lib/clinic/resolve-clinic-role";
import { checkPortalLoginEligibility } from "@/lib/clinic/portal-login-eligibility";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email } = body as { email?: string; role?: string };

    if (!email?.trim()) {
      return NextResponse.json({ error: "Email requerido." }, { status: 400 });
    }

    const intendedRole = parseClinicDbRole(body.role) ?? "paciente";
    const normalizedEmail = email.trim().toLowerCase();

    const origin = resolveAppOrigin(request.headers.get("origin"));

    const serviceClient = await createServiceClient();

    const eligibility = await checkPortalLoginEligibility(
      serviceClient,
      normalizedEmail,
      intendedRole,
    );
    if (!eligibility.eligible) {
      return NextResponse.json({ error: eligibility.message }, { status: 404 });
    }

    const redirectTo = buildPasswordRecoveryRedirect(origin, intendedRole);
    const { data, error } = await serviceClient.auth.admin.generateLink({
      type: "recovery",
      email: normalizedEmail,
      options: { redirectTo },
    });

    if (error) {
      console.error("[reset-password] generateLink error:", error.message);
      return NextResponse.json(
        { error: "No se pudo generar el enlace de recuperación." },
        { status: 500 },
      );
    }

    const resetUrl: string = data?.properties?.action_link ?? "";

    if (!resetUrl) {
      console.error("[reset-password] no action_link in response");
      return NextResponse.json(
        { error: "No se pudo generar el enlace de recuperación." },
        { status: 500 },
      );
    }

    if (!isMailConfigured()) {
      console.warn("[reset-password] SMTP not configured — reset URL:", resetUrl);
      return NextResponse.json(
        { error: "El envío de correo no está configurado." },
        { status: 503 },
      );
    }

    await sendPasswordResetEmail({ email: email.trim(), resetUrl, origin });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[reset-password]", err);
    return NextResponse.json(
      { error: "Error al enviar el correo de recuperación." },
      { status: 500 },
    );
  }
}
