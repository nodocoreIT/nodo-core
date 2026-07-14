import { NextRequest, NextResponse } from "next/server";
import { sendPasswordResetEmail } from "@/lib/mail";

/**
 * POST /api/clinic/account/forgot-password
 *
 * Generates a recovery link via the admin SDK and sends a branded
 * password-reset email through Zoho SMTP — replaces the default
 * Supabase Auth template.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const body = await request.json().catch(() => ({}));
  const email = String(body.email ?? "").trim().toLowerCase();

  if (!email) {
    return NextResponse.json({ error: "email is required" }, { status: 400 });
  }

  const origin = request.headers.get("origin") ?? process.env.NEXT_PUBLIC_BASE_URL ?? "";
  const redirectTo = `${origin}/actualizar-contrasena`;

  // Use the admin SDK to generate a recovery link without sending the
  // default Supabase email.
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
    // Don't leak whether the email exists — always return ok.
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
