import type { LocalDoctor } from "@/lib/clinic/types";

/** Token manual legacy o OAuth guardado (sin refrescar). */
export function readStoredAccessToken(doctor: LocalDoctor): string | undefined {
  const oauth = doctor.payment?.mercadopagoAccessToken?.trim();
  if (oauth && !oauth.startsWith("····")) return oauth;

  const env =
    process.env.CLINIC_MERCADOPAGO_ACCESS_TOKEN?.trim() ||
    process.env.MERCADOPAGO_ACCESS_TOKEN?.trim();
  return env || undefined;
}

/** Indica si el médico tiene MP habilitado y credenciales (sin leer la DB). */
export function doctorHasMercadoPagoConnection(doctor: LocalDoctor): boolean {
  const p = doctor.payment;
  if (!p?.mercadopagoEnabled) return false;
  return !!(
    readStoredAccessToken(doctor) ||
    p.mercadopagoRefreshToken ||
    p.mercadopagoUserId
  );
}
