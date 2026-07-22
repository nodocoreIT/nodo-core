import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { isMailConfigured, sendPasswordResetEmail } from "@/lib/mail";
import { resolveAppOrigin } from "@/lib/clinic/appointment-payment";
import {
  buildPasswordRecoveryRedirect,
  canAccessAsRole,
  lookupClinicMembershipByEmail,
  parseClinicDbRole,
} from "@/lib/clinic/resolve-clinic-role";

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

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const serviceClient = (await createServiceClient()) as any;

    const membership = await lookupClinicMembershipByEmail(
      serviceClient,
      normalizedEmail,
    );

    if (!canAccessAsRole(membership, intendedRole)) {
      // Do not reveal whether the email exists.
      return NextResponse.json({ ok: true });
    }

    const redirectTo = buildPasswordRecoveryRedirect(origin, intendedRole);
    const { data, error } = await serviceClient.auth.admin.generateLink({
      type: "recovery",
      email: normalizedEmail,
      options: { redirectTo },
    });

    if (error) {
      console.error("[reset-password] generateLink error:", error.message);
      return NextResponse.json({ ok: true });
    }

    const resetUrl: string = data?.properties?.action_link ?? "";

    if (!resetUrl) {
      console.error("[reset-password] no action_link in response");
      return NextResponse.json({ ok: true });
    }

    if (!isMailConfigured()) {
      console.warn("[reset-password] SMTP not configured — reset URL:", resetUrl);
      return NextResponse.json({ ok: true });
    }

    await sendPasswordResetEmail({ email: email.trim(), resetUrl, origin });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[reset-password]", err);
    return NextResponse.json({ ok: true });
  }
}
