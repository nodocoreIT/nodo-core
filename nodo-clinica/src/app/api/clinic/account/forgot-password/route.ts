import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { sendPasswordResetEmail } from "@/lib/mail";
import {
  buildPasswordRecoveryRedirect,
  canAccessAsRole,
  lookupClinicMembershipByEmail,
  parseClinicDbRole,
} from "@/lib/clinic/resolve-clinic-role";

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

  const origin = request.headers.get("origin") ?? process.env.NEXT_PUBLIC_BASE_URL ?? "";
  const service = await createServiceClient();

  const membership = await lookupClinicMembershipByEmail(service, email);
  if (!canAccessAsRole(membership, intendedRole)) {
    return NextResponse.json({ ok: true });
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
    return NextResponse.json({ ok: true });
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
