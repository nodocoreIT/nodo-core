import { NextResponse } from "next/server";
import { getMpOAuthConfig, isPkceEnabled } from "@/lib/mercadopago/oauth";

export const dynamic = "force-dynamic";

/** Muestra la redirect_uri y client_id activos (sin secretos). */
export async function GET() {
  const config = getMpOAuthConfig();
  if (!config) {
    return NextResponse.json({
      configured: false,
      error: "Faltan MERCADOPAGO_CLIENT_ID y/o MERCADOPAGO_CLIENT_SECRET en Vercel.",
    });
  }

  const secret = process.env.MERCADOPAGO_CLIENT_SECRET?.trim() ?? "";

  return NextResponse.json({
    configured: true,
    redirectUri: config.redirectUri,
    clientId: config.clientId,
    oauthTestToken: process.env.MERCADOPAGO_OAUTH_TEST_TOKEN === "true",
    pkceEnabled: isPkceEnabled(),
    secretHint: secret.startsWith("APP_USR-")
      ? "INCORRECTO: pegaste el Access Token como CLIENT_SECRET. Buscá el campo Client Secret aparte."
      : secret.length < 10
        ? "SECRET muy corto — revisá Vercel"
        : "ok",
    checklist: [
      `En developers.mercadopago.com → tu app (${config.clientId}) → Detalles, agregá esta Redirect URL exacta: ${config.redirectUri}`,
      isPkceEnabled()
        ? "En la misma pantalla, activá «Authorization code con PKCE» (Editar aplicación)."
        : "PKCE desactivado en .env (MERCADOPAGO_OAUTH_PKCE=false). No actives PKCE en el panel MP.",
      "Client ID y Client Secret deben ser de ESA misma aplicación (no del Access Token del vendedor).",
      "Probá en ventana de incógnito con usuario de prueba TESTUSER… si MERCADOPAGO_OAUTH_TEST_TOKEN=true.",
    ],
    diagnoseUrl: "/api/clinic/mercadopago/oauth/diagnose",
  });
}
