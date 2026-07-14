import { createHash, randomBytes, randomUUID } from "crypto";

const MP_AUTH_URL = "https://auth.mercadopago.com/authorization";
const MP_TOKEN_URL = "https://api.mercadopago.com/oauth/token";

export interface MpOAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

export interface MpOAuthTokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  user_id?: number;
  public_key?: string;
  live_mode?: boolean;
  token_type?: string;
  scope?: string;
}

export function getMpOAuthConfig(): MpOAuthConfig | null {
  const clientId = process.env.MERCADOPAGO_CLIENT_ID?.trim();
  const clientSecret = process.env.MERCADOPAGO_CLIENT_SECRET?.trim();
  const redirectUri =
    process.env.MERCADOPAGO_OAUTH_REDIRECT_URI?.trim() ||
    (process.env.NEXT_PUBLIC_APP_URL
      ? `${process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "")}/api/clinic/mercadopago/oauth/callback`
      : process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL}/api/clinic/mercadopago/oauth/callback`
        : "http://localhost:3002/api/clinic/mercadopago/oauth/callback");

  if (!clientId || !clientSecret) return null;
  return { clientId, clientSecret, redirectUri };
}

function base64Url(buffer: Buffer): string {
  return buffer.toString("base64url");
}

/** PKCE — recomendado por Mercado Pago. */
export function generatePkcePair() {
  const codeVerifier = base64Url(randomBytes(32));
  const codeChallenge = base64Url(
    createHash("sha256").update(codeVerifier).digest(),
  );
  return {
    codeVerifier,
    codeChallenge,
    codeChallengeMethod: "S256" as const,
  };
}

export function newOAuthState(): string {
  return randomUUID();
}

export function isPkceEnabled(): boolean {
  return process.env.MERCADOPAGO_OAUTH_PKCE !== "false";
}

export function buildAuthorizationUrl(params: {
  config: MpOAuthConfig;
  state: string;
  codeChallenge?: string;
  codeChallengeMethod?: string;
}): string {
  const q = new URLSearchParams({
    response_type: "code",
    client_id: params.config.clientId,
    redirect_uri: params.config.redirectUri,
    state: params.state,
    platform_id: "mp",
  });
  if (params.codeChallenge) {
    q.set("code_challenge", params.codeChallenge);
    q.set("code_challenge_method", params.codeChallengeMethod ?? "S256");
  }
  return `${MP_AUTH_URL}?${q.toString()}`;
}

async function postToken(
  body: Record<string, string>,
): Promise<MpOAuthTokenResponse> {
  const res = await fetch(MP_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = (await res.json()) as MpOAuthTokenResponse & {
    message?: string;
    error?: string;
  };
  if (!res.ok) {
    console.error("[mp-oauth] token error", data);
    throw new Error(
      data.message || data.error || "Error al obtener token de Mercado Pago",
    );
  }
  return data;
}

export async function exchangeAuthorizationCode(params: {
  config: MpOAuthConfig;
  code: string;
  codeVerifier?: string;
  testToken?: boolean;
}): Promise<MpOAuthTokenResponse> {
  return postToken({
    client_id: params.config.clientId,
    client_secret: params.config.clientSecret,
    grant_type: "authorization_code",
    code: params.code,
    redirect_uri: params.config.redirectUri,
    ...(params.codeVerifier ? { code_verifier: params.codeVerifier } : {}),
    ...(params.testToken ? { test_token: "true" } : {}),
  });
}

export async function refreshOAuthToken(params: {
  config: MpOAuthConfig;
  refreshToken: string;
}): Promise<MpOAuthTokenResponse> {
  return postToken({
    client_id: params.config.clientId,
    client_secret: params.config.clientSecret,
    grant_type: "refresh_token",
    refresh_token: params.refreshToken,
  });
}

export function tokenExpiresAtIso(expiresInSeconds?: number): string | undefined {
  if (!expiresInSeconds || expiresInSeconds <= 0) return undefined;
  return new Date(Date.now() + expiresInSeconds * 1000).toISOString();
}

export function isTokenExpired(expiresAtIso?: string, skewMs = 5 * 60_000): boolean {
  if (!expiresAtIso) return false;
  return Date.now() >= new Date(expiresAtIso).getTime() - skewMs;
}
