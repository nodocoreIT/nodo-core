import { NextRequest, NextResponse } from "next/server";
import { verifyMercadoPagoWebhookSignature } from "@/lib/mercadopago/webhook-verify";
import { processMercadoPagoPaymentId } from "@/lib/mercadopago/handle-payment-webhook";

export const dynamic = "force-dynamic";

function extractPaymentId(request: NextRequest, body?: unknown): string | null {
  const { searchParams } = new URL(request.url);
  let paymentId =
    searchParams.get("data.id") ||
    searchParams.get("id") ||
    searchParams.get("data_id");

  if (!paymentId && body && typeof body === "object") {
    const b = body as Record<string, unknown>;
    const data = b.data as Record<string, unknown> | undefined;
    paymentId =
      data?.id?.toString() ||
      b.id?.toString() ||
      null;
  }

  return paymentId?.trim() || null;
}

/** Webhook IPN de Mercado Pago — confirma turno y notifica al médico. */
export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    body = undefined;
  }

  const paymentId = extractPaymentId(request, body);
  if (!paymentId) {
    return NextResponse.json({ ok: true, skipped: "no payment id" });
  }

  const webhookSecret = process.env.MERCADOPAGO_WEBHOOK_SECRET?.trim();
  if (webhookSecret) {
    const valid = verifyMercadoPagoWebhookSignature({
      xSignature: request.headers.get("x-signature"),
      xRequestId: request.headers.get("x-request-id"),
      dataId: paymentId,
      secret: webhookSecret,
    });
    if (!valid) {
      console.warn("[mp-webhook] invalid signature for payment", paymentId);
      return NextResponse.json({ error: "Firma inválida" }, { status: 401 });
    }
  }

  try {
    const result = await processMercadoPagoPaymentId(paymentId);
    return NextResponse.json(result);
  } catch (err) {
    console.error("[mp-webhook] processing failed", err);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  return POST(request);
}
