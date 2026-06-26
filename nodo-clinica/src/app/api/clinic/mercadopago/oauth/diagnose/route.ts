// @ts-nocheck
import { NextResponse } from "next/server";
import { getMpOAuthConfig } from "@/lib/mercadopago/oauth";

export const dynamic = "force-dynamic";

/** Valida client_id + client_secret contra MP (sin exponer el secret). */
export async function GET() {
  const config = getMpOAuthConfig();
  if (!config) {
    return NextResponse.json({
      ok: false,
      step: "env",
      message: "Faltan MERCADOPAGO_CLIENT_ID o MERCADOPAGO_CLIENT_SECRET en Vercel.",
    });
  }

  const secret = config.clientSecret;
  if (secret.startsWith("APP_USR-")) {
    return NextResponse.json({
      ok: false,
      step: "secret_format",
      message:
        "MERCADOPAGO_CLIENT_SECRET no puede ser el Access Token (APP_USR-...). En el panel MP buscá el campo Client Secret / Secreto de la aplicación.",
      redirectUri: config.redirectUri,
      clientId: config.clientId,
    });
  }

  try {
    const res = await fetch("https://api.mercadopago.com/oauth/token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: config.clientId,
        client_secret: config.clientSecret,
        grant_type: "client_credentials",
      }),
    });
    const data = (await res.json()) as { message?: string; error?: string };

    if (!res.ok) {
      return NextResponse.json({
        ok: false,
        step: "mp_token",
        message: data.message || data.error || `MP respondió ${res.status}`,
        redirectUri: config.redirectUri,
        clientId: config.clientId,
        fix:
          "Revisá que Client ID y Client Secret sean de la misma app donde configuraste la Redirect URL.",
      });
    }

    return NextResponse.json({
      ok: true,
      redirectUri: config.redirectUri,
      clientId: config.clientId,
      oauthTestToken: process.env.MERCADOPAGO_OAUTH_TEST_TOKEN === "true",
      message:
        "Credenciales OAuth válidas. Si falla al conectar, usá el usuario de prueba TESTUSER… en incógnito.",
    });
  } catch (err) {
    return NextResponse.json({
      ok: false,
      step: "network",
      message: err instanceof Error ? err.message : "Error de red",
    });
  }
}
