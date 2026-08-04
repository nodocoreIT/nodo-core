import "server-only";

/**
 * Read-only MP REST helpers shared by the subscription webhook and the
 * reconciliation job. Always called with NODO's own LANDING_MERCADOPAGO_ACCESS_TOKEN.
 */

const MP_API = "https://api.mercadopago.com";

export interface MpPreapprovalInfo {
  id: string;
  status: string;
  external_reference?: string;
  next_payment_date?: string;
}

/** GET /preapproval/{id} — overall subscription status (pending|authorized|paused|cancelled). */
export async function getPreapproval(
  accessToken: string,
  preapprovalId: string,
): Promise<MpPreapprovalInfo> {
  const res = await fetch(`${MP_API}/preapproval/${preapprovalId}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.message || "Error al consultar el Preapproval en Mercado Pago");
  }
  return data as MpPreapprovalInfo;
}

/** PUT /preapproval/{id} { status: "cancelled" } — voluntary cancel, stops future charges. */
export async function cancelPreapproval(
  accessToken: string,
  preapprovalId: string,
): Promise<MpPreapprovalInfo> {
  const res = await fetch(`${MP_API}/preapproval/${preapprovalId}`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ status: "cancelled" }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.message || "Error al cancelar el Preapproval en Mercado Pago");
  }
  return data as MpPreapprovalInfo;
}

export interface MpAuthorizedPaymentInfo {
  id: number | string;
  preapproval_id?: string;
  transaction_amount?: number | string;
  currency_id?: string;
  debit_date?: string;
  date_created?: string;
  retry_attempt?: number;
  /** Invoice-level status (e.g. "scheduled", "processed") — NOT the charge outcome. */
  status?: string;
  /** The actual charge outcome lives here, not in the top-level `status`. */
  payment?: { id?: number | string; status?: string; status_detail?: string };
}

/** GET /authorized_payments/{id} — a single recurring-charge invoice/attempt. */
export async function getAuthorizedPayment(
  accessToken: string,
  authorizedPaymentId: string,
): Promise<MpAuthorizedPaymentInfo> {
  const res = await fetch(`${MP_API}/authorized_payments/${authorizedPaymentId}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(
      data.message || "Error al consultar el pago autorizado en Mercado Pago",
    );
  }
  return data as MpAuthorizedPaymentInfo;
}
