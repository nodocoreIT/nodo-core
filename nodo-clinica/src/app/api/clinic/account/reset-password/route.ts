import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { isMailConfigured, sendPasswordResetEmail } from "@/lib/mail";

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json();
    const { email } = body as { email?: string };

    if (!email?.trim()) {
      return NextResponse.json({ error: "Email requerido." }, { status: 400 });
    }

    const origin =
      request.headers.get("origin") ??
      process.env.NEXT_PUBLIC_BASE_URL ??
      "";

    // Use admin client to generate the password reset link server-side.
    // This lets us send it via our own SMTP instead of Supabase's default email.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const serviceClient = (await createServiceClient()) as any;

    const redirectTo = `${origin}/actualizar-contrasena`;
    const { data, error } = await serviceClient.auth.admin.generateLink({
      type: "recovery",
      email: email.trim().toLowerCase(),
      options: { redirectTo },
    });

    if (error) {
      // Don't reveal whether the email exists — always return 200 to the client.
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
    // Always return 200 — never reveal account existence to the client.
    return NextResponse.json({ ok: true });
  }
}
