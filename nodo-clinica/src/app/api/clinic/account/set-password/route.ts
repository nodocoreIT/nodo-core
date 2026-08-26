import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

const LINK_INVALID_MESSAGE =
  "El enlace expiró o ya fue usado. Solicitá uno nuevo.";

/**
 * POST /api/clinic/account/set-password
 *
 * Sets a user's password during account activation / password recovery, using
 * the service role so it never depends on a fragile browser session surviving
 * until the user finishes typing.
 *
 * Two inputs are supported:
 *  - `activationToken` (preferred): our own single-use token from
 *    nodo_clinica.account_activation_tokens, minted when an admin enables the
 *    account. Opening the page never spends it — only this POST does — so email
 *    prefetch/scanners can't consume it, and it has a lifetime we control.
 *  - `accessToken` (legacy): a Supabase recovery access_token captured client
 *    side, validated here with the service role. Kept for in-flight recovery
 *    links from the login "forgot password" flow.
 */
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const { activationToken, accessToken, password } = body as {
    activationToken?: string;
    accessToken?: string;
    password?: string;
  };

  if (!password) {
    return NextResponse.json({ error: "Faltan datos requeridos." }, { status: 400 });
  }
  if (password.length < 6) {
    return NextResponse.json(
      { error: "La contraseña debe tener al menos 6 caracteres." },
      { status: 400 },
    );
  }

  const svc = await createServiceClient();

  let userId: string | null = null;
  let email: string | null = null;
  let role: string | null = null;

  if (activationToken) {
    // account_activation_tokens isn't in the generated Database types yet, so
    // cast the client like the rest of the codebase does for untyped tables.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: tokenRow } = await (svc as any)
      .from("account_activation_tokens")
      .select("token, user_id, email, role, expires_at, used_at")
      .eq("token", activationToken)
      .maybeSingle() as {
        data: {
          token: string;
          user_id: string;
          email: string;
          role: string;
          expires_at: string;
          used_at: string | null;
        } | null;
      };

    if (
      !tokenRow ||
      tokenRow.used_at ||
      new Date(tokenRow.expires_at).getTime() < Date.now()
    ) {
      return NextResponse.json({ error: LINK_INVALID_MESSAGE }, { status: 401 });
    }

    userId = tokenRow.user_id;
    email = tokenRow.email;
    role = tokenRow.role;
  } else if (accessToken) {
    const { data: { user }, error: tokenError } = await svc.auth.getUser(accessToken);
    if (tokenError || !user) {
      return NextResponse.json({ error: LINK_INVALID_MESSAGE }, { status: 401 });
    }
    userId = user.id;
    email = user.email ?? null;
  } else {
    return NextResponse.json({ error: "Faltan datos requeridos." }, { status: 400 });
  }

  const { error: updateError } = await svc.auth.admin.updateUserById(userId, {
    password,
    email_confirm: true,
  });
  // If the user re-typed their current password, Supabase rejects it with
  // "New password should be different from the old password." That's not a real
  // failure for this flow — the account already has exactly the password they
  // want, so accept it: fall through, burn the token, and return ok. The email
  // is already confirmed for any account that has a previous password.
  const samePassword =
    updateError?.message === "New password should be different from the old password.";
  if (updateError && !samePassword) {
    return NextResponse.json({ error: updateError.message }, { status: 400 });
  }

  // Burn the single-use activation token now that the password is set.
  if (activationToken) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (svc as any)
      .from("account_activation_tokens")
      .update({ used_at: new Date().toISOString() })
      .eq("token", activationToken);
  }

  return NextResponse.json({ ok: true, userId, email, role });
}
