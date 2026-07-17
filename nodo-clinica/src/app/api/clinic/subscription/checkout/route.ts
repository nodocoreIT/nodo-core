import { NextRequest, NextResponse } from "next/server";
import { requireAuth, resolveProfessional } from "@/lib/supabase/auth-guard";
import { appBaseUrl } from "@/lib/clinic/appointment-payment";
import { createPreapproval } from "@/lib/mercadopago/client";
import { createServiceClient } from "@/lib/supabase/server";
import { findSubscriptionPlan } from "@/lib/clinic/subscription-plans";

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
    .select("subscription_status, subscription_plan, subscription_next_payment_at")
    .eq("id", professional.id)
    .maybeSingle();

  return NextResponse.json({
    status: data?.subscription_status ?? "trial",
    plan: data?.subscription_plan ?? null,
    nextPaymentAt: data?.subscription_next_payment_at ?? null,
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

  const base = appBaseUrl();

  try {
    const preapproval = await createPreapproval({
      accessToken: nodoAccessToken,
      reason: `Suscripción ${plan.name} — Nodo Clínica`,
      payerEmail: professional.email,
      externalReference: professional.id,
      amount: plan.amount,
      currency: plan.currency,
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
