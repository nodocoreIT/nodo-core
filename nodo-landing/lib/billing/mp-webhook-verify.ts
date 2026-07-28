import { createHmac, timingSafeEqual } from "crypto";

/**
 * Verifies MercadoPago's `x-signature` header (Webhooks v2). Identical
 * algorithm to nodo-clinica's `verifyMercadoPagoWebhookSignature`
 * (lib/mercadopago/webhook-verify.ts) — this is MP's generic webhook v2
 * scheme, not app-specific, so both apps implement it independently against
 * their own webhook secret.
 * @see https://www.mercadopago.com.ar/developers/es/docs/your-integrations/notifications/webhooks
 */
export function verifyMpWebhookSignature(params: {
  xSignature: string | null;
  xRequestId: string | null;
  dataId: string;
  secret: string;
}): boolean {
  const { xSignature, xRequestId, dataId, secret } = params;
  if (!xSignature || !xRequestId || !secret.trim()) return false;

  const parts = Object.fromEntries(
    xSignature.split(",").map((p) => {
      const [k, v] = p.trim().split("=");
      return [k, v ?? ""];
    }),
  );
  const ts = parts.ts;
  const received = parts.v1;
  if (!ts || !received) return false;

  const manifest = `id:${dataId};request-id:${xRequestId};ts:${ts};`;
  const expected = createHmac("sha256", secret.trim())
    .update(manifest)
    .digest("hex");

  try {
    return timingSafeEqual(
      Buffer.from(received, "utf8"),
      Buffer.from(expected, "utf8"),
    );
  } catch {
    return false;
  }
}
