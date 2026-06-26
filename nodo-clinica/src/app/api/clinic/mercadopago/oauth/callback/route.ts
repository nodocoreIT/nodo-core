import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/supabase/auth-guard";
import {
  exchangeAuthorizationCode,
  getMpOAuthConfig,
  tokenExpiresAtIso,
} from "@/lib/mercadopago/oauth";
import { createServiceClient } from "@/lib/supabase/server";
import { upsertPaymentCredentials, clearOAuthTokensFromOfficeSettings } from "@/lib/clinic/db/payments";

export const dynamic = "force-dynamic";

function settingsRedirect(base: string, params: Record<string, string>) {
  const q = new URLSearchParams({ tab: "cobros", ...params });
  return NextResponse.redirect(`${base}/medico/configuracion?${q.toString()}`);
}

/** Callback OAuth — intercambia `code` por tokens y los guarda en payment_credentials. */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  const appBase =
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ||
    (process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : "http://localhost:3002");

  if (error) {
    return settingsRedirect(appBase, { mp: "error", mp_msg: error });
  }

  if (!code || !state) {
    return settingsRedirect(appBase, { mp: "error", mp_msg: "missing_code" });
  }

  const config = getMpOAuthConfig();
  if (!config) {
    return settingsRedirect(appBase, { mp: "error", mp_msg: "oauth_not_configured" });
  }

  // Find the org that has this pending OAuth state
  const supabase = await createServiceClient();
  const { data: settings } = await supabase
    .from("office_settings")
    .select("org_id, payment")
    .not("payment->mercadopagoOAuthPending", "is", null);

  type OAuthPending = { state: string; codeVerifier: string; createdAt: string };
  const match = (settings ?? []).find((s) => {
    const p = s.payment as Record<string, unknown> | null;
    const pending = p?.mercadopagoOAuthPending as OAuthPending | undefined;
    return pending?.state === state;
  });

  if (!match) {
    return settingsRedirect(appBase, { mp: "error", mp_msg: "invalid_state" });
  }

  const payment = match.payment as Record<string, unknown>;
  const pending = payment.mercadopagoOAuthPending as OAuthPending;
  const pendingAge = Date.now() - new Date(pending.createdAt).getTime();
  if (pendingAge > 15 * 60_000) {
    return settingsRedirect(appBase, { mp: "error", mp_msg: "expired_state" });
  }

  // Verify the session belongs to the same org
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) {
    return settingsRedirect(appBase, { mp: "error", mp_msg: "session_mismatch" });
  }
  if (auth.user.org_id !== match.org_id) {
    return settingsRedirect(appBase, { mp: "error", mp_msg: "session_mismatch" });
  }

  try {
    const useTest =
      process.env.MERCADOPAGO_OAUTH_TEST_TOKEN !== "false" &&
      (process.env.MERCADOPAGO_OAUTH_TEST_TOKEN === "true" ||
        process.env.MERCADOPAGO_USE_TEST_CREDENTIALS === "true");

    const tokens = await exchangeAuthorizationCode({
      config,
      code,
      codeVerifier: pending.codeVerifier,
      testToken: useTest,
    });

    const expiresAt = tokenExpiresAtIso(tokens.expires_in);

    // Store tokens in isolated payment_credentials table (service_role only)
    await upsertPaymentCredentials(match.org_id, {
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token ?? null,
      public_key: tokens.public_key ?? null,
      token_expires_at: expiresAt ?? null,
    });

    // Clear pending state + clean tokens from office_settings
    const { [Symbol.iterator]: _, ...restPayment } = Object.entries(payment)
      .filter(([k]) => k !== "mercadopagoOAuthPending")
      .reduce((acc, [k, v]) => ({ ...acc, [k]: v }), {} as Record<string, unknown>);
    void _;

    const cleanedPayment = Object.fromEntries(
      Object.entries(payment).filter(([k]) => k !== "mercadopagoOAuthPending"),
    );
    cleanedPayment.mercadopagoEnabled = true;

    await supabase
      .from("office_settings")
      .update({ payment: cleanedPayment })
      .eq("org_id", match.org_id);

    // Also clear any legacy tokens from office_settings.payment JSONB
    await clearOAuthTokensFromOfficeSettings(match.org_id);

    console.info("[mp-oauth] connected org", match.org_id, {
      userId: tokens.user_id,
      liveMode: tokens.live_mode,
    });

    return settingsRedirect(appBase, { mp: "connected" });
  } catch (err) {
    console.error("[mp-oauth] callback failed", err);
    // Clear pending state on failure
    const cleanedPayment = Object.fromEntries(
      Object.entries(payment).filter(([k]) => k !== "mercadopagoOAuthPending"),
    );
    await supabase
      .from("office_settings")
      .update({ payment: cleanedPayment })
      .eq("org_id", match.org_id);

    return settingsRedirect(appBase, {
      mp: "error",
      mp_msg: err instanceof Error ? err.message.slice(0, 80) : "token_exchange",
    });
  }
}
