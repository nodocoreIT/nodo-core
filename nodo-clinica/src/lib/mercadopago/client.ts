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
  const res = await fetch(`${MP_API}/checkout/preferences`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${params.accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
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
      back_urls: params.backUrls,
      auto_return: "approved",
    }),
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
