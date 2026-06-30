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

export { doctorHasMercadoPagoConnection, readStoredAccessToken };

/**
 * Obtiene Access Token del médico; refresca vía OAuth si está por vencer.
 * Nunca exponer al frontend.
 */
export async function getDoctorMercadoPagoAccessToken(
  doctorOrId: LocalDoctor | string,
): Promise<string | undefined> {
  const db = await readDb();
  const doctor =
    typeof doctorOrId === "string"
      ? db.doctors.find((d) => d.id === doctorOrId)
      : doctorOrId;
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

  if (!payment.mercadopagoRefreshToken) {
    return manual;
  }

  const config = getMpOAuthConfig();
  if (!config) {
    console.error("[mp-tokens] missing OAuth config for refresh");
    return manual;
  }

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
