import { NextResponse } from "next/server";
import { getMpOAuthConfig } from "@/lib/mercadopago/oauth";

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
    secretHint: secret.startsWith("APP_USR-")
      ? "INCORRECTO: pegaste el Access Token como CLIENT_SECRET. Buscá el campo Client Secret aparte."
      : secret.length < 10
        ? "SECRET muy corto — revisá Vercel"
        : "ok",
    hint: "redirectUri y clientId deben coincidir con el panel MP de esta app.",
  });
}
