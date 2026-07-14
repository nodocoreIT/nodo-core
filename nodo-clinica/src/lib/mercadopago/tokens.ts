import { isLocalMode } from "@/lib/clinic/config";
import {
  getPaymentCredentials,
  getOrgMercadoPagoAccessToken,
} from "@/lib/clinic/db/payments";
import { readDb, writeDb, type LocalDoctor } from "@/lib/clinic/local-db";
import {
  doctorHasMercadoPagoConnection,
  readStoredAccessToken,
} from "@/lib/mercadopago/connection";
import {
  getMpOAuthConfig,
  isTokenExpired,
  refreshOAuthToken,
  tokenExpiresAtIso,
} from "@/lib/mercadopago/oauth";
import { createServiceClient } from "@/lib/supabase/server";

export { getOrgMercadoPagoAccessToken, doctorHasMercadoPagoConnection, readStoredAccessToken };

export async function orgHasMercadoPagoConnection(orgId: string): Promise<boolean> {
  if (isLocalMode()) {
    const db = await readDb();
    const doctor = db.doctors.find((d) => d.orgId === orgId || d.id === orgId);
    return doctor ? doctorHasMercadoPagoConnection(doctor) : false;
  }
  const token = await getOrgMercadoPagoAccessToken(orgId);
  return !!token;
}

/** Access token del médico/org; refresca OAuth si corresponde. Nunca exponer al cliente. */
export async function getDoctorMercadoPagoAccessToken(
  doctorOrOrgId: LocalDoctor | string,
): Promise<string | undefined> {
  if (isLocalMode()) {
    const db = await readDb();
    const doctor =
      typeof doctorOrOrgId === "string"
        ? db.doctors.find((d) => d.id === doctorOrOrgId)
        : doctorOrOrgId;
    if (!doctor?.payment?.mercadopagoEnabled) return undefined;

    const payment = doctor.payment;
    const manual = readStoredAccessToken(doctor);
    const needsRefresh =
      payment.mercadopagoRefreshToken &&
      isTokenExpired(payment.mercadopagoTokenExpiresAt);

    if (!needsRefresh && manual) return manual;

    if (!needsRefresh && payment.mercadopagoAccessToken?.trim()) {
      const t = payment.mercadopagoAccessToken.trim();
      if (!t.startsWith("····")) return t;
    }

    if (!payment.mercadopagoRefreshToken) return manual;

    const config = getMpOAuthConfig();
    if (!config) return manual;

    try {
      const refreshed = await refreshOAuthToken({
        config,
        refreshToken: payment.mercadopagoRefreshToken,
      });
      const expiresAt = tokenExpiresAtIso(refreshed.expires_in);

      await writeDb((d) => {
        const target = d.doctors.find((x) => x.id === doctor.id);
        if (!target?.payment) return;
        target.payment.mercadopagoAccessToken = refreshed.access_token;
        if (refreshed.refresh_token) {
          target.payment.mercadopagoRefreshToken = refreshed.refresh_token;
        }
        if (expiresAt) target.payment.mercadopagoTokenExpiresAt = expiresAt;
        if (refreshed.user_id != null) {
          target.payment.mercadopagoUserId = String(refreshed.user_id);
        }
      });

      return refreshed.access_token;
    } catch (err) {
      console.error("[mp-tokens] refresh failed", err);
      return manual;
    }
  }

  const orgId = typeof doctorOrOrgId === "string" ? doctorOrOrgId : doctorOrOrgId.orgId;
  if (!orgId) return undefined;

  const creds = await getPaymentCredentials(orgId);
  const needsRefresh =
    !!creds?.refresh_token && isTokenExpired(creds.token_expires_at ?? undefined);

  if (!needsRefresh && creds?.access_token?.trim()) {
    return creds.access_token.trim();
  }

  const envToken =
    process.env.CLINIC_MERCADOPAGO_ACCESS_TOKEN?.trim() ||
    process.env.MERCADOPAGO_ACCESS_TOKEN?.trim();

  if (!needsRefresh) return envToken || undefined;
  if (!creds?.refresh_token) return envToken || undefined;

  const config = getMpOAuthConfig();
  if (!config) return creds?.access_token || envToken || undefined;

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
