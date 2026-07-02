import { randomUUID } from "crypto";

const MP_API = "https://api.mercadopago.com";

export interface MpQrOrderResult {
  id: string;
  status?: string;
  qrData?: string;
  externalReference?: string;
  raw: unknown;
}

/**
 * Crea una orden QR (modo dynamic) con el Access Token del médico vendedor.
 * Requiere `external_pos_id` de una caja creada en Mercado Pago.
 * @see https://www.mercadopago.com.ar/developers/es/reference/in-person-payments/qr-code/orders/create-order/post
 */
export async function createQrOrder(params: {
  accessToken: string;
  amount: number;
  currency?: string;
  description: string;
  externalReference: string;
  externalPosId: string;
  mode?: "dynamic" | "static" | "hybrid";
  expirationMinutes?: number;
}): Promise<MpQrOrderResult> {
  const body = {
    type: "qr",
    total_amount: params.amount.toFixed(2),
    description: params.description.slice(0, 256),
    external_reference: params.externalReference,
    expiration_time: `PT${params.expirationMinutes ?? 30}M`,
    config: {
      qr: {
        external_pos_id: params.externalPosId,
        mode: params.mode ?? "dynamic",
      },
    },
    transactions: {
      payments: [{ amount: params.amount.toFixed(2) }],
    },
    items: [
      {
        title: params.description.slice(0, 256),
        unit_price: params.amount.toFixed(2),
        quantity: 1,
        unit_measure: "unit",
      },
    ],
  };

  const res = await fetch(`${MP_API}/v1/orders`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${params.accessToken}`,
      "Content-Type": "application/json",
      "X-Idempotency-Key": randomUUID(),
    },
    body: JSON.stringify(body),
  });

  const data = await res.json();
  if (!res.ok) {
    console.error("[mp-qr] create order error", data);
    throw new Error(
      (data as { message?: string }).message ||
        (data as { error?: string }).error ||
        "Error al crear orden QR en Mercado Pago",
    );
  }

  const typed = data as {
    id?: string;
    status?: string;
    type_response?: { qr_data?: string };
    external_reference?: string;
  };

  return {
    id: typed.id ?? "",
    status: typed.status,
    qrData: typed.type_response?.qr_data,
    externalReference: typed.external_reference,
    raw: data,
  };
}

export async function getQrOrder(
  accessToken: string,
  orderId: string,
): Promise<unknown> {
  const res = await fetch(`${MP_API}/v1/orders/${orderId}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(
      (data as { message?: string }).message || "Error al consultar orden QR",
    );
  }
  return data;
}
