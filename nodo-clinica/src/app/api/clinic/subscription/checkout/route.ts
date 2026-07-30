import { NextRequest, NextResponse } from "next/server";
import { requireAuth, resolveProfessional } from "@/lib/supabase/auth-guard";
import { appBaseUrl } from "@/lib/clinic/appointment-payment";
import { createPreapproval } from "@/lib/mercadopago/client";
import { createServiceClient } from "@/lib/supabase/server";
import { findSubscriptionPlan } from "@/lib/clinic/subscription-plans";
import { resolveFxRate } from "@/lib/mercadopago/fx-rate";

export const dynamic = "force-dynamic";

/** Current subscription status for the logged-in doctor. */
export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;
  if (auth.user.role !== "doctor") {
    return NextResponse.json({ error: "Debe iniciar sesión como médico" }, { status: 401 });
  }

  const professional = await resolveProfessional(auth);
  if (!professional) {
    return NextResponse.json({ error: "Médico no encontrado" }, { status: 404 });
  }

  const supabase = await createServiceClient();
  const { data } = await supabase
    .from("professionals")
    .select("subscription_status, subscription_plan, subscription_next_payment_at, trial_ends_at")
    .eq("id", professional.id)
    .maybeSingle();

  return NextResponse.json({
    status: data?.subscription_status ?? "trial",
    plan: data?.subscription_plan ?? null,
    nextPaymentAt: data?.subscription_next_payment_at ?? null,
    trialEndsAt: data?.trial_ends_at ?? null,
  });
}

/**
 * Starts a doctor's monthly Nodo platform subscription (MercadoPago
 * Preapproval). Billed FROM the doctor TO Nodo — always uses Nodo's own
 * production access token (MERCADOPAGO_ACCESS_TOKEN), never the doctor's
 * connected OAuth token (that one is for the doctor collecting from patients).
 */
export async function POST(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;
  const { user } = auth;

  if (user.role !== "doctor") {
    return NextResponse.json({ error: "Debe iniciar sesión como médico" }, { status: 401 });
  }

  const professional = await resolveProfessional(auth);
  if (!professional) {
    return NextResponse.json({ error: "Médico no encontrado" }, { status: 404 });
  }

  const body = await request.json().catch(() => ({}));
  const plan = findSubscriptionPlan(String(body.planId ?? ""));
  if (!plan) {
    return NextResponse.json({ error: "Plan inválido" }, { status: 400 });
  }

  const nodoAccessToken = process.env.MERCADOPAGO_ACCESS_TOKEN?.trim();
  if (!nodoAccessToken) {
    return NextResponse.json(
      { error: "Falta configurar MERCADOPAGO_ACCESS_TOKEN (cuenta de Nodo) en el servidor." },
      { status: 503 },
    );
  }

  // MercadoPago Argentina rejects auto_recurring.currency_id = "USD"
  // ("Invalid field") — Preapproval subscriptions must be billed in ARS even
  // though nodo_core.planes prices this plan in USD. Convert at dólar-tarjeta
  // rate, mirroring nodo-landing/lib/billing/mp-preapproval.ts.
  let billingAmount = plan.amount;
  if (plan.currency === "USD") {
    const fx = await resolveFxRate();
    if (!fx.ok) {
      return NextResponse.json(
        { error: "No se pudo obtener la cotización del dólar para procesar el cobro. Reintentá en unos minutos." },
        { status: 503 },
      );
    }
    billingAmount = Math.round(plan.amount * fx.rate * 100) / 100;
  }
  const billingCurrency = plan.currency === "USD" ? "ARS" : plan.currency;

  const base = appBaseUrl();

  try {
    const preapproval = await createPreapproval({
      accessToken: nodoAccessToken,
      reason: `Suscripción ${plan.name} — Nodo Clínica`,
      payerEmail: professional.email,
      externalReference: professional.id,
      amount: billingAmount,
      currency: billingCurrency,
      backUrl: `${base}/medico/dashboard?settings=suscripcion`,
    });

    const supabase = await createServiceClient();
    await supabase
      .from("professionals")
      .update({ mercadopago_preapproval_id: preapproval.id, subscription_plan: plan.id })
      .eq("id", professional.id);

    return NextResponse.json({ initPoint: preapproval.initPoint });
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? err.message
            : "Error al iniciar la suscripción con Mercado Pago",
      },
      { status: 502 },
    );
  }
}
