import { NextRequest, NextResponse } from "next/server";
import { isLocalMode } from "@/lib/clinic/config";
import { readDb, writeDb } from "@/lib/clinic/local-db";
import { getSessionFromRequest } from "@/lib/clinic/session";
import { requireAuth } from "@/lib/supabase/auth-guard";
import {
  exchangeAuthorizationCode,
  getMpOAuthConfig,
  tokenExpiresAtIso,
} from "@/lib/mercadopago/oauth";
import { createServiceClient } from "@/lib/supabase/server";
import {
  upsertPaymentCredentials,
  clearOAuthTokensFromOfficeSettings,
} from "@/lib/clinic/db/payments";

export const dynamic = "force-dynamic";

function settingsRedirect(base: string, params: Record<string, string>) {
  const q = new URLSearchParams({ settings: "cobros", ...params });
  return NextResponse.redirect(`${base}/medico/dashboard?${q.toString()}`);
}

/** Callback OAuth — intercambia `code` por tokens y los guarda. */
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

  const useTest =
    process.env.MERCADOPAGO_OAUTH_TEST_TOKEN !== "false" &&
    (process.env.MERCADOPAGO_OAUTH_TEST_TOKEN === "true" ||
      process.env.MERCADOPAGO_USE_TEST_CREDENTIALS === "true");

  if (isLocalMode()) {
    const db = await readDb();
    const doctor = db.doctors.find(
      (d) => d.payment?.mercadopagoOAuthPending?.state === state,
    );

    if (!doctor?.payment?.mercadopagoOAuthPending) {
      return settingsRedirect(appBase, { mp: "error", mp_msg: "invalid_state" });
    }

    const pending = doctor.payment.mercadopagoOAuthPending;
    if (Date.now() - new Date(pending.createdAt).getTime() > 15 * 60_000) {
      return settingsRedirect(appBase, { mp: "error", mp_msg: "expired_state" });
    }

    const session = await getSessionFromRequest(request);
    if (!session || session.role !== "doctor" || session.userId !== doctor.id) {
      return settingsRedirect(appBase, { mp: "error", mp_msg: "session_mismatch" });
    }

    try {
      const tokens = await exchangeAuthorizationCode({
        config,
        code,
        ...(pending.codeVerifier ? { codeVerifier: pending.codeVerifier } : {}),
        testToken: useTest,
      });

      const now = new Date().toISOString();
      const expiresAt = tokenExpiresAtIso(tokens.expires_in);

      await writeDb((d) => {
        const target = d.doctors.find((x) => x.id === doctor.id);
        if (!target) return;
        target.payment = {
          ...(target.payment ?? { currency: "ARS", requirePaymentBeforeBooking: true }),
          mercadopagoEnabled: true,
          mercadopagoAccessToken: tokens.access_token,
          mercadopagoRefreshToken: tokens.refresh_token,
          mercadopagoTokenExpiresAt: expiresAt,
          mercadopagoUserId:
            tokens.user_id != null ? String(tokens.user_id) : undefined,
          mercadopagoPublicKey: tokens.public_key,
          mercadopagoConnectedAt: now,
          mercadopagoOAuthPending: undefined,
        };
      });

      return settingsRedirect(appBase, { mp: "connected" });
    } catch (err) {
      console.error("[mp-oauth] callback failed", err);
      await writeDb((d) => {
        const target = d.doctors.find((x) => x.id === doctor.id);
        if (target?.payment) target.payment.mercadopagoOAuthPending = undefined;
      });
      return settingsRedirect(appBase, {
        mp: "error",
        mp_msg: err instanceof Error ? err.message.slice(0, 80) : "token_exchange",
      });
    }
  }

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
  if (Date.now() - new Date(pending.createdAt).getTime() > 15 * 60_000) {
    return settingsRedirect(appBase, { mp: "error", mp_msg: "expired_state" });
  }

  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) {
    return settingsRedirect(appBase, { mp: "error", mp_msg: "session_mismatch" });
  }
  if (auth.user.org_id !== match.org_id) {
    return settingsRedirect(appBase, { mp: "error", mp_msg: "session_mismatch" });
  }

  try {
    const tokens = await exchangeAuthorizationCode({
      config,
      code,
      ...(pending.codeVerifier ? { codeVerifier: pending.codeVerifier } : {}),
      testToken: useTest,
    });

    const expiresAt = tokenExpiresAtIso(tokens.expires_in);

    await upsertPaymentCredentials(match.org_id, {
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token ?? null,
      public_key: tokens.public_key ?? null,
      token_expires_at: expiresAt ?? null,
    });

    const cleanedPayment = Object.fromEntries(
      Object.entries(payment).filter(([k]) => k !== "mercadopagoOAuthPending"),
    );
    cleanedPayment.mercadopagoEnabled = true;

    await supabase
      .from("office_settings")
      .update({ payment: cleanedPayment })
      .eq("org_id", match.org_id);

    await clearOAuthTokensFromOfficeSettings(match.org_id);

    return settingsRedirect(appBase, { mp: "connected" });
  } catch (err) {
    console.error("[mp-oauth] callback failed", err);
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
