import { NextResponse } from "next/server";
import { createNodoCoreServiceClient } from "@/lib/supabase/server";

/**
 * GET /api/clinic/account/onboarding/plans
 *
 * Read-only display pricing for the médico and paciente onboarding plan
 * cards, sourced from nodo_core.planes (unit_code "Clínica") — the same
 * catalog managed from the nodo-landing admin panel. Display-only: does NOT
 * affect the plan id submitted at onboarding, nor the checkout flows
 * (app/api/clinic/subscription/checkout, app/api/clinic/patient-subscription/checkout),
 * which keep using their own separate id space (demo/profesional,
 * gratuito/pago) untouched.
 *
 * amountAnnual is nodo_core.planes.price_annual_monthly — despite the
 * column name, it already stores the TOTAL annual amount (price_monthly ×
 * 10, "10 months paid for 12"), not a monthly-equivalent rate.
 */
export async function GET(): Promise<NextResponse> {
  try {
    const db = await createNodoCoreServiceClient();
    const { data, error } = await db
      .from("planes")
      .select("code, label, price_monthly, price_annual_monthly, currency")
      .eq("unit_code", "Clínica")
      .eq("is_active", true)
      .in("code", ["medico_demo", "medico_pro", "paciente_gratis", "paciente_pro"]);

    if (error) {
      console.error("[onboarding/plans] query error", error);
      return NextResponse.json({ ok: false, plans: {} });
    }

    const plans: Record<
      string,
      { label: string; amount: number; amountAnnual: number; currency: string }
    > = {};
    for (const row of data ?? []) {
      plans[row.code as string] = {
        label: row.label as string,
        amount: Number(row.price_monthly),
        amountAnnual: Number(row.price_annual_monthly) || 0,
        currency: row.currency as string,
      };
    }

    return NextResponse.json({ ok: true, plans });
  } catch (err) {
    console.error("[onboarding/plans]", err);
    return NextResponse.json({ ok: false, plans: {} });
  }
}
