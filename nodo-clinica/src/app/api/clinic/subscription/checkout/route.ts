import { NextRequest, NextResponse } from "next/server";
import { requireAuth, resolveProfessional } from "@/lib/supabase/auth-guard";
import { appBaseUrl } from "@/lib/clinic/appointment-payment";
import { createServiceClient } from "@/lib/supabase/server";
import { findSubscriptionPlan } from "@/lib/clinic/subscription-plans";
import { createNodoSubscriptionPreapproval } from "@/lib/mercadopago/nodo-subscription";

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
    status: data?.subscription_status ?? "demo",
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

  const result = await createNodoSubscriptionPreapproval({
    plan,
    payerEmail: professional.email,
    externalReference: professional.id,
    backUrl: `${appBaseUrl()}/medico/dashboard?settings=suscripcion`,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  const supabase = await createServiceClient();
  const { error: updateError } = await supabase
    .from("professionals")
    .update({ mercadopago_preapproval_id: result.preapprovalId, subscription_plan: plan.id })
    .eq("id", professional.id);

  if (updateError) {
    console.error("[subscription/checkout] failed to persist preapproval id", updateError);
    return NextResponse.json(
      { error: "No se pudo guardar la suscripción. Reintentá en unos minutos." },
      { status: 500 },
    );
  }

  return NextResponse.json({ initPoint: result.initPoint });
}
