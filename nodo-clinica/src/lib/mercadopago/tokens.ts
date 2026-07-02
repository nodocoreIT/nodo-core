/**
 * MercadoPago token helpers — Supabase version.
 *
 * Tokens are stored in nodo_clinica.payment_credentials (service_role only).
 * getDoctorMercadoPagoAccessToken is kept for API compatibility but now
 * accepts an orgId string instead of a LocalDoctor object.
 *
 * Legacy LocalDoctor overload is removed — callers must be migrated.
 */

import {
  getPaymentCredentials,
  getOrgMercadoPagoAccessToken,
} from "@/lib/clinic/db/payments";
import { getMpOAuthConfig, isTokenExpired, refreshOAuthToken, tokenExpiresAtIso } from "@/lib/mercadopago/oauth";
import { createServiceClient } from "@/lib/supabase/server";

export { getOrgMercadoPagoAccessToken };

/**
 * Returns true if the org has MercadoPago credentials.
 * Replaces doctorHasMercadoPagoConnection.
 */
export async function orgHasMercadoPagoConnection(orgId: string): Promise<boolean> {
  const token = await getOrgMercadoPagoAccessToken(orgId);
  return !!token;
}

/**
 * Reads and optionally refreshes the MP access token for an org.
 * Service_role only — never returns token to client.
 */
export async function getDoctorMercadoPagoAccessToken(
  orgId: string,
): Promise<string | undefined> {
  const creds = await getPaymentCredentials(orgId);

  const needsRefresh =
    !!creds?.refresh_token && isTokenExpired(creds.token_expires_at ?? undefined);

  if (!needsRefresh && creds?.access_token?.trim()) {
    return creds.access_token.trim();
  }

  // Env var fallback
  const envToken =
    process.env.CLINIC_MERCADOPAGO_ACCESS_TOKEN?.trim() ||
    process.env.MERCADOPAGO_ACCESS_TOKEN?.trim();

  if (!needsRefresh) return envToken || undefined;
  if (!creds?.refresh_token) return envToken || undefined;

  const config = getMpOAuthConfig();
  if (!config) {
    console.error("[mp-tokens] missing OAuth config for refresh");
    return creds?.access_token || envToken || undefined;
  }

  try {
    const refreshed = await refreshOAuthToken({
      config,
      refreshToken: creds.refresh_token,
    });
    const expiresAt = tokenExpiresAtIso(refreshed.expires_in);

    const supabase = await createServiceClient();
    await supabase
      .from("payment_credentials")
      .update({
        access_token: refreshed.access_token,
        ...(refreshed.refresh_token ? { refresh_token: refreshed.refresh_token } : {}),
        ...(expiresAt ? { token_expires_at: expiresAt } : {}),
        updated_at: new Date().toISOString(),
      })
      .eq("org_id", orgId);

    return refreshed.access_token;
  } catch (err) {
    console.error("[mp-tokens] refresh failed", err);
    return creds?.access_token || envToken || undefined;
  }
}

/** @deprecated Use orgHasMercadoPagoConnection(orgId) */
export function doctorHasMercadoPagoConnection(_doctor: unknown): boolean {
  console.warn("[mp-tokens] doctorHasMercadoPagoConnection is deprecated — use orgHasMercadoPagoConnection(orgId)");
  return false;
}

/** @deprecated Use getDoctorMercadoPagoAccessToken(orgId) */
export function readStoredAccessToken(_doctor: unknown): string | undefined {
  console.warn("[mp-tokens] readStoredAccessToken is deprecated — use getDoctorMercadoPagoAccessToken(orgId)");
  return undefined;
}
