import { NextRequest, NextResponse } from "next/server";
import { readDb, writeDb } from "@/lib/clinic/local-db";
import { getSessionFromRequest } from "@/lib/clinic/session";
import {
  exchangeAuthorizationCode,
  getMpOAuthConfig,
  tokenExpiresAtIso,
} from "@/lib/mercadopago/oauth";

export const dynamic = "force-dynamic";

function settingsRedirect(base: string, params: Record<string, string>) {
  const q = new URLSearchParams(params);
  return NextResponse.redirect(`${base}/medico/dashboard?${q.toString()}`);
}

/** Callback OAuth — intercambia `code` por tokens y los guarda en el médico. */
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
    return settingsRedirect(appBase, {
      mp: "error",
      mp_msg: error,
    });
  }

  if (!code || !state) {
    return settingsRedirect(appBase, {
      mp: "error",
      mp_msg: "missing_code",
    });
  }

  const config = getMpOAuthConfig();
  if (!config) {
    return settingsRedirect(appBase, {
      mp: "error",
      mp_msg: "oauth_not_configured",
    });
  }

  const db = await readDb();
  const doctor = db.doctors.find(
    (d) => d.payment?.mercadopagoOAuthPending?.state === state,
  );

  if (!doctor?.payment?.mercadopagoOAuthPending) {
    return settingsRedirect(appBase, {
      mp: "error",
      mp_msg: "invalid_state",
    });
  }

  const pending = doctor.payment.mercadopagoOAuthPending;
  const pendingAge = Date.now() - new Date(pending.createdAt).getTime();
  if (pendingAge > 15 * 60_000) {
    return settingsRedirect(appBase, {
      mp: "error",
      mp_msg: "expired_state",
    });
  }

  const session = await getSessionFromRequest(request);
  if (!session || session.role !== "doctor" || session.userId !== doctor.id) {
    return settingsRedirect(appBase, {
      mp: "error",
      mp_msg: "session_mismatch",
    });
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

    const now = new Date().toISOString();
    const expiresAt = tokenExpiresAtIso(tokens.expires_in);

    await writeDb((d) => {
      const target = d.doctors.find((x) => x.id === doctor.id);
      if (!target) return;
      target.payment = {
        ...(target.payment ?? {}),
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

    console.info("[mp-oauth] connected doctor", doctor.id, {
      userId: tokens.user_id,
      liveMode: tokens.live_mode,
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
