export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/supabase/auth-guard";
import { createServiceClient, createNodoCoreServiceClient } from "@/lib/supabase/server";
import { appBaseUrl } from "@/lib/clinic/appointment-payment";
import { createPreapproval } from "@/lib/mercadopago/client";
import { resolveFxRate } from "@/lib/mercadopago/fx-rate";
import {
  getPatientPaidCheckoutPlan,
  isPatientPaidPlan,
} from "@/lib/clinic/patient-subscription-plans";

/** nodo_core.planes code for the patient paid plan (unit_code "Clínica"). */
const PACIENTE_PRO_DB_CODE = "paciente_pro";

/** GET — current patient subscription plan + live pricing (for settings UI). */
export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;
  if (auth.user.role !== "patient") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const svc = (await createServiceClient()) as any;
  const { data, error } = await svc
    .from("patients")
    .select("subscription_plan, mercadopago_preapproval_id")
    .eq("profile_id", auth.user.id)
    .maybeSingle();

  if (error) {
    console.error("[patient-subscription/checkout GET] patient lookup failed:", error);
  }

  // Fetch live pricing from nodo_core.planes for display
  const nodoCoreDb = await createNodoCoreServiceClient();
  const { data: planRow } = await nodoCoreDb
    .from("planes")
    .select("price_monthly, currency")
    .eq("unit_code", "Clínica")
    .eq("code", PACIENTE_PRO_DB_CODE)
    .eq("is_active", true)
    .maybeSingle();

  return NextResponse.json({
    plan: data?.subscription_plan ?? "gratuito",
    hasPreapproval: Boolean(data?.mercadopago_preapproval_id),
    pricing: planRow
      ? {
          amount: Number(planRow.price_monthly),
          currency: planRow.currency as string,
        }
      : null,
  });
}

/** POST — starts Mercado Pago checkout for the patient paid plan. */
export async function POST(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;
  if (auth.user.role !== "patient") {
    return NextResponse.json({ error: "Debés iniciar sesión como paciente" }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const planId = String(body.planId ?? "pago").trim();
  if (!isPatientPaidPlan(planId)) {
    return NextResponse.json({ error: "Plan inválido" }, { status: 400 });
  }
  const billingCycle = body.billingCycle === "annual" ? "annual" : "monthly";

  const plan = getPatientPaidCheckoutPlan();
  const nodoAccessToken = process.env.MERCADOPAGO_ACCESS_TOKEN?.trim();
  if (!nodoAccessToken) {
    console.error(
      "[patient-subscription checkout POST] MERCADOPAGO_ACCESS_TOKEN not found. Available env keys:",
      Object.keys(process.env).filter(k => k.includes("MERCADO")).join(", ") || "none"
    );
    return NextResponse.json(
      { error: "Falta configurar MERCADOPAGO_ACCESS_TOKEN en el servidor." },
      { status: 503 },
    );
  }

  // Price siempre se lee en vivo de nodo_core.planes (mismo catálogo que
  // /panel/unidades/clinica) — nunca el monto estático de
  // patient-subscription-plans.ts, que es solo fallback de display.
  const nodoCoreDb = await createNodoCoreServiceClient();
  const { data: planRow, error: planRowError } = await nodoCoreDb
    .from("planes")
    .select("price_monthly, price_annual_monthly, currency")
    .eq("unit_code", "Clínica")
    .eq("code", PACIENTE_PRO_DB_CODE)
    .eq("is_active", true)
    .maybeSingle();

  if (planRowError || !planRow) {
    return NextResponse.json(
      { error: `No se encontró un plan activo '${PACIENTE_PRO_DB_CODE}' en nodo_core.planes.` },
      { status: 503 },
    );
  }

  const currency = (planRow.currency as string) ?? plan.currency;
  const sourceAmount =
    billingCycle === "annual" ? Number(planRow.price_annual_monthly) : Number(planRow.price_monthly);
  if (!Number.isFinite(sourceAmount) || sourceAmount <= 0) {
    return NextResponse.json(
      { error: `Plan '${PACIENTE_PRO_DB_CODE}' no tiene precio ${billingCycle === "annual" ? "anual" : "mensual"} configurado.` },
      { status: 503 },
    );
  }

  let billingAmount = sourceAmount;
  if (currency === "USD") {
    const fx = await resolveFxRate();
    if (!fx.ok) {
      return NextResponse.json(
        { error: "No se pudo obtener la cotización del dólar para procesar el cobro. Reintentá en unos minutos." },
        { status: 503 },
      );
    }
    billingAmount = Math.round(sourceAmount * fx.rate * 100) / 100;
  }
  const billingCurrency = currency === "USD" ? "ARS" : currency;
  const frequency = billingCycle === "annual" ? 12 : 1;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const svc = (await createServiceClient()) as any;
  const { data: patient, error: patientError } = await svc
    .from("patients")
    .select("id, email, subscription_plan")
    .eq("profile_id", auth.user.id)
    .maybeSingle();

  if (patientError || !patient?.id) {
    return NextResponse.json({ error: "Paciente no encontrado" }, { status: 404 });
  }

  const payerEmail = (patient.email as string | null) ?? auth.user.email ?? "";
  if (!payerEmail) {
    return NextResponse.json({ error: "Tu cuenta no tiene email para facturar." }, { status: 400 });
  }

  if (patient.subscription_plan === planId) {
    return NextResponse.json({ error: "Ya tenés activo este plan." }, { status: 400 });
  }

  let preapproval;
  try {
    preapproval = await createPreapproval({
      accessToken: nodoAccessToken,
      reason: `Suscripción ${plan.name} — Nodo Clínica Pacientes (${billingCycle === "annual" ? "anual" : "mensual"})`,
      payerEmail,
      externalReference: patient.id as string,
      amount: billingAmount,
      currency: billingCurrency,
      backUrl: `${appBaseUrl()}/paciente/inicio?settings=suscripcion`,
      frequency,
    });
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

  if (!preapproval.initPoint) {
    return NextResponse.json(
      { error: "Mercado Pago no devolvió un link de pago." },
      { status: 502 },
    );
  }

  const { error: updateError } = await svc
    .from("patients")
    .update({
      mercadopago_preapproval_id: preapproval.id,
    })
    .eq("id", patient.id);

  if (updateError) {
    console.error("[patient-subscription/checkout] failed to persist preapproval id", updateError);
    return NextResponse.json(
      { error: "No se pudo guardar la suscripción. Reintentá en unos minutos." },
      { status: 500 },
    );
  }

  return NextResponse.json({ initPoint: preapproval.initPoint });
}
