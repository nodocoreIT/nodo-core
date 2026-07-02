const MP_API = "https://api.mercadopago.com";

export interface MpPreferenceResult {
  id: string;
  initPoint: string;
  sandboxInitPoint?: string;
}

export interface MpPaymentInfo {
  id: number;
  status: string;
  status_detail?: string;
  external_reference?: string;
  transaction_amount?: number;
  currency_id?: string;
}

export interface MpUserInfo {
  id: number;
  nickname?: string;
  email?: string;
  live_mode?: boolean;
}

function mpCurrency(currency?: string): string {
  const c = (currency ?? "ARS").toUpperCase();
  return c === "USD" ? "USD" : "ARS";
}

function isHttpsUrl(url: string): boolean {
  return url.startsWith("https://");
}

/** Mensaje legible desde respuestas de error de MP. */
export function formatMercadoPagoApiError(data: unknown): string {
  if (!data || typeof data !== "object") {
    return "Error de Mercado Pago";
  }
  const d = data as Record<string, unknown>;
  const msg = String(d.message || d.error || "").trim();
  if (/UNAUTHORIZED|PA_UNAUTHORIZED/i.test(msg)) {
    return "Access Token de Mercado Pago inválido o vencido. En Configuración → Cobros reconectá tu cuenta o pegá un token de prueba (TEST-…) del vendedor de prueba.";
  }
  if (msg) return msg;
  const causes = Array.isArray(d.cause) ? d.cause : [];
  for (const c of causes) {
    if (c && typeof c === "object" && "description" in c) {
      return String((c as { description?: string }).description);
    }
  }
  return "Error de Mercado Pago";
}

/** Valida que el Access Token sea aceptado por la API. */
export async function getMercadoPagoUser(
  accessToken: string,
): Promise<MpUserInfo> {
  const res = await fetch(`${MP_API}/users/me`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(formatMercadoPagoApiError(data));
  }
  return data as MpUserInfo;
}

export async function createCheckoutPreference(params: {
  accessToken: string;
  title: string;
  amount: number;
  currency?: string;
  externalReference: string;
  payerEmail: string;
  notificationUrl: string;
  backUrls: { success: string; failure: string; pending: string };
}): Promise<MpPreferenceResult> {
  const body: Record<string, unknown> = {
    items: [
      {
        title: params.title.slice(0, 256),
        quantity: 1,
        unit_price: Number(params.amount),
        currency_id: mpCurrency(params.currency),
      },
    ],
    payer: { email: params.payerEmail },
    external_reference: params.externalReference,
    back_urls: params.backUrls,
  };

  // MP exige HTTPS para auto_return y suele fallar con localhost http
  if (isHttpsUrl(params.notificationUrl)) {
    body.notification_url = params.notificationUrl;
  }
  if (isHttpsUrl(params.backUrls.success)) {
    body.auto_return = "approved";
  }

  const res = await fetch(`${MP_API}/checkout/preferences`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${params.accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(formatMercadoPagoApiError(data));
  }

  return {
    id: data.id,
    initPoint: data.init_point,
    sandboxInitPoint: data.sandbox_init_point,
  };
}

export async function getPayment(
  accessToken: string,
  paymentId: string
): Promise<MpPaymentInfo> {
  const res = await fetch(`${MP_API}/v1/payments/${paymentId}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.message || "Error al consultar pago en Mercado Pago");
  }
  return data as MpPaymentInfo;
}

/** Prefer sandbox URL cuando el token es de prueba (TEST-). */
export function checkoutUrl(
  pref: MpPreferenceResult,
  accessToken: string,
): string {
  if (accessToken.startsWith("TEST-") && pref.sandboxInitPoint) {
    return pref.sandboxInitPoint;
  }
  return pref.initPoint;
}

export function mercadoPagoTokenKind(
  accessToken?: string,
): "test" | "production" | "missing" {
  const t = accessToken?.trim();
  if (!t || t.startsWith("····")) return "missing";
  if (t.startsWith("TEST-")) return "test";
  return "production";
}
