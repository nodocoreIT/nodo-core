import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { sendPasswordResetEmail } from "@/lib/mail";
import { resolveAppOriginFromRequest } from "@/lib/clinic/appointment-payment";
import {
  buildPasswordRecoveryRedirect,
  parseClinicDbRole,
} from "@/lib/clinic/resolve-clinic-role";
import { checkPortalLoginEligibility } from "@/lib/clinic/portal-login-eligibility";

/**
 * POST /api/clinic/account/forgot-password
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const body = await request.json().catch(() => ({}));
  const email = String(body.email ?? "").trim().toLowerCase();
  const intendedRole = parseClinicDbRole(body.role) ?? "paciente";

  if (!email) {
    return NextResponse.json({ error: "email is required" }, { status: 400 });
  }

  const origin = resolveAppOriginFromRequest(request);
  const service = await createServiceClient();

  const eligibility = await checkPortalLoginEligibility(
    service,
    email,
    intendedRole,
  );
  if (!eligibility.eligible) {
    return NextResponse.json({ error: eligibility.message }, { status: 404 });
  }

  const redirectTo = buildPasswordRecoveryRedirect(origin, intendedRole);

  const { createClient } = await import("@supabase/supabase-js");
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );

  const { data: linkData, error: linkError } =
    await admin.auth.admin.generateLink({
      type: "recovery",
      email,
      options: { redirectTo },
    });

  if (linkError || !linkData?.properties?.action_link) {
    console.error("[forgot-password] generateLink error", linkError);
    return NextResponse.json(
      { error: "No se pudo generar el enlace de recuperación." },
      { status: 500 },
    );
  }

  try {
    await sendPasswordResetEmail({
      email,
      resetUrl: linkData.properties.action_link,
      origin,
    });
  } catch (err) {
    console.error("[forgot-password] email error", err);
    return NextResponse.json(
      { error: "Error sending email" },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true });
}
