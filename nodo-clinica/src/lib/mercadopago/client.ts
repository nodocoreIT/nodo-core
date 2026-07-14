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

function mpCurrency(currency?: string): string {
  const c = (currency ?? "ARS").toUpperCase();
  return c === "USD" ? "USD" : "ARS";
}

/** MP solo acepta auto_return con URLs https públicas (no localhost). */
function canUseAutoReturn(successUrl: string): boolean {
  try {
    const u = new URL(successUrl);
    if (u.hostname === "localhost" || u.hostname === "127.0.0.1") return false;
    return u.protocol === "https:";
  } catch {
    return false;
  }
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
  const back_urls = {
    success: params.backUrls.success.trim(),
    failure: params.backUrls.failure.trim(),
    pending: params.backUrls.pending.trim(),
  };
  if (!back_urls.success) {
    throw new Error(
      "Falta la URL de retorno. Configurá NEXT_PUBLIC_APP_URL en .env.local (ej. http://localhost:3002).",
    );
  }

  const preferenceBody: Record<string, unknown> = {
    items: [
      {
        title: params.title.slice(0, 256),
        quantity: 1,
        unit_price: params.amount,
        currency_id: mpCurrency(params.currency),
      },
    ],
    payer: { email: params.payerEmail },
    external_reference: params.externalReference,
    notification_url: params.notificationUrl,
    back_urls,
  };
  if (canUseAutoReturn(back_urls.success)) {
    preferenceBody.auto_return = "approved";
  }

  const res = await fetch(`${MP_API}/checkout/preferences`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${params.accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(preferenceBody),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(
      data.message || data.error || "Error al crear preferencia de Mercado Pago"
    );
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
  accessToken: string
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

export async function getMercadoPagoUser(accessToken: string): Promise<{
  id: number;
  nickname?: string;
  live_mode?: boolean;
}> {
  const res = await fetch(`${MP_API}/users/me`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const data = (await res.json()) as {
    id?: number;
    nickname?: string;
    live_mode?: boolean;
    message?: string;
    error?: string;
  };
  if (!res.ok) {
    throw new Error(
      data.message || data.error || "Token rechazado por Mercado Pago",
    );
  }
  if (data.id == null) {
    throw new Error("Respuesta inválida de Mercado Pago");
  }
  return {
    id: data.id,
    nickname: data.nickname,
    live_mode: data.live_mode,
  };
}
