import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

/**
 * POST /api/clinic/account/set-password
 *
 * Sets a user's password from a recovery/invite flow using the raw access_token
 * captured at session-establishment time — not the browser's mutable Supabase
 * client session, which can go stale by the time the user finishes typing a
 * password (recovery sessions issued via admin.generateLink are short-lived and
 * not reliably auto-refreshable). Validating the token server-side with the
 * service role avoids depending on that fragile client-side session surviving
 * until submit.
 */
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const { accessToken, password } = body as {
    accessToken?: string;
    password?: string;
  };

  if (!accessToken || !password) {
    return NextResponse.json(
      { error: "Faltan datos requeridos." },
      { status: 400 },
    );
  }
  if (password.length < 6) {
    return NextResponse.json(
      { error: "Password should be at least 6 characters." },
      { status: 400 },
    );
  }

  const svc = await createServiceClient();

  const { data: { user }, error: tokenError } = await svc.auth.getUser(accessToken);
  if (tokenError || !user) {
    return NextResponse.json(
      { error: "El enlace expiró o ya fue usado. Solicitá uno nuevo." },
      { status: 401 },
    );
  }

  const { error: updateError } = await svc.auth.admin.updateUserById(user.id, {
    password,
  });
  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true, userId: user.id, email: user.email });
}
