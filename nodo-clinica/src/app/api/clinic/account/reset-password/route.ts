import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { isMailConfigured, sendPasswordResetEmail } from "@/lib/mail";
import { resolveAppOriginFromRequest } from "@/lib/clinic/appointment-payment";
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

    const origin = resolveAppOriginFromRequest(request);

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

    if (process.env.NODE_ENV === "development") {
      console.info("[reset-password] redirectTo:", redirectTo);
    }

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
      return NextResponse.json({
        ok: true,
        redirectTo,
        resetUrl,
        mailConfigured: false,
        hint:
          "En local, agregá redirectTo en Supabase → Auth → URL Configuration. Si el link cae en :3000, la Site URL del proyecto apunta al landing.",
      });
    }

    await sendPasswordResetEmail({ email: email.trim(), resetUrl, origin });

    return NextResponse.json({
      ok: true,
      ...(process.env.NODE_ENV === "development"
        ? { redirectTo, resetUrl, mailConfigured: true }
        : {}),
    });
  } catch (err) {
    console.error("[reset-password]", err);
    return NextResponse.json(
      { error: "Error al enviar el correo de recuperación." },
      { status: 500 },
    );
  }
}
