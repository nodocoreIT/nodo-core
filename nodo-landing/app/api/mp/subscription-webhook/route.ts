import { NextRequest, NextResponse } from "next/server";
import { verifyMpWebhookSignature } from "@/lib/billing/mp-webhook-verify";
import {
  processSubscriptionAuthorizedPayment,
  processSubscriptionPreapprovalUpdate,
} from "@/lib/billing/mp-webhook-handler";

/**
 * POST /api/mp/subscription-webhook
 *
 * MP Preapproval webhook for the platform-billing engine — separate from any
 * nodo-clinica webhook route (that one bills doctors, this one bills
 * client_units). Configure this exact URL in MP's Developers > Notifications
 * panel for the LANDING_MERCADOPAGO_ACCESS_TOKEN account.
 */
export const dynamic = "force-dynamic";

function extractType(request: NextRequest, body?: unknown): string | null {
  const { searchParams } = new URL(request.url);
  const fromQuery = searchParams.get("type");
  if (fromQuery) return fromQuery;
  if (body && typeof body === "object") {
    const t = (body as Record<string, unknown>).type;
    if (typeof t === "string") return t;
  }
  return null;
}

function extractDataId(request: NextRequest, body?: unknown): string | null {
  const { searchParams } = new URL(request.url);
  let dataId =
    searchParams.get("data.id") || searchParams.get("id") || searchParams.get("data_id");

  if (!dataId && body && typeof body === "object") {
    const b = body as Record<string, unknown>;
    const data = b.data as Record<string, unknown> | undefined;
    dataId = data?.id?.toString() || b.id?.toString() || null;
  }

  return dataId?.trim() || null;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    body = undefined;
  }

  const dataId = extractDataId(request, body);
  if (!dataId) {
    return NextResponse.json({ ok: true, skipped: "no_data_id" });
  }

  const webhookSecret = process.env.LANDING_MERCADOPAGO_WEBHOOK_SECRET?.trim();
  if (webhookSecret) {
    const valid = verifyMpWebhookSignature({
      xSignature: request.headers.get("x-signature"),
      xRequestId: request.headers.get("x-request-id"),
      dataId,
      secret: webhookSecret,
    });
    if (!valid) {
      console.warn("[subscription-webhook] invalid signature for", dataId);
      return NextResponse.json({ error: "Firma inválida" }, { status: 401 });
    }
  }

  const type = extractType(request, body);
  const isAuthorizedPayment =
    type === "subscription_authorized_payment" || type === "authorized_payment";
  const isPreapprovalEvent = type === "subscription_preapproval" || type === "preapproval";

  if (!isAuthorizedPayment && !isPreapprovalEvent) {
    return NextResponse.json({ ok: true, skipped: `unhandled_type:${type ?? "unknown"}` });
  }

  try {
    const result = isAuthorizedPayment
      ? await processSubscriptionAuthorizedPayment(dataId)
      : await processSubscriptionPreapprovalUpdate(dataId);
    return NextResponse.json(result);
  } catch (err) {
    console.error("[subscription-webhook] processing failed", err);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  return POST(request);
}
