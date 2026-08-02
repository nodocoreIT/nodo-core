import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createPreapproval } from "@/lib/billing/mp-preapproval";
import { resolveClientUnitForAuthUser } from "@/lib/billing/resolve-client-unit-for-user";

export const dynamic = "force-dynamic";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, content-type",
};

function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status, headers: CORS_HEADERS });
}

async function resolveAuthUser(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user: cookieUser },
  } = await supabase.auth.getUser();
  if (cookieUser) return cookieUser;

  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;

  const token = authHeader.slice("Bearer ".length).trim();
  if (!token) return null;

  const admin = createAdminClient();
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data.user) return null;
  return data.user;
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

/**
 * Starts or changes the platform subscription for the caller's client_unit.
 * Body: { unitCode: string, planCode: string, backUrl?: string }
 */
export async function POST(request: NextRequest) {
  const user = await resolveAuthUser(request);
  if (!user?.email) {
    return json({ error: "Debés iniciar sesión para cambiar de plan." }, 401);
  }

  const body = await request.json().catch(() => ({}));
  const unitCode = String(body.unitCode ?? "").trim();
  const planCode = String(body.planCode ?? "").trim();
  const backUrl = typeof body.backUrl === "string" ? body.backUrl.trim() : "";

  if (!unitCode || !planCode) {
    return json({ error: "unitCode y planCode son obligatorios." }, 400);
  }

  const db = createAdminClient();

  const unit = await resolveClientUnitForAuthUser(db, {
    email: user.email,
    unitCode,
  });

  if (!unit) {
    return json({ error: "No encontramos tu cuenta en este nodo." }, 404);
  }

  const { data: planRow, error: planError } = await db
    .from("planes")
    .select("id, code, label, price_monthly, currency, is_active")
    .ilike("unit_code", unitCode)
    .eq("code", planCode)
    .maybeSingle();

  if (planError || !planRow) {
    return json({ error: "Plan inválido o inactivo." }, 400);
  }

  const plan = planRow as {
    id: string;
    code: string;
    label: string;
    price_monthly: number | string;
    currency: string;
    is_active: boolean;
  };

  if (!plan.is_active) {
    return json({ error: "Ese plan ya no está disponible." }, 400);
  }

  const priceMonthly = Number(plan.price_monthly);
  if (!Number.isFinite(priceMonthly) || priceMonthly <= 0) {
    const { error: freeUpdateError } = await db
      .from("client_units")
      .update({ plan: plan.code, updated_at: new Date().toISOString() })
      .eq("id", unit.id);

    if (freeUpdateError) {
      return json({ error: "No se pudo actualizar el plan gratuito." }, 500);
    }

    return json({ ok: true, planChanged: true, requiresPayment: false });
  }

  const nowIso = new Date().toISOString();
  const patch: Record<string, string> = { plan: plan.code, updated_at: nowIso };
  if (!unit.enabledAt) {
    patch.enabled_at = nowIso;
  }

  const { error: unitUpdateError } = await db
    .from("client_units")
    .update(patch)
    .eq("id", unit.id);

  if (unitUpdateError) {
    return json({ error: "No se pudo preparar el cambio de plan." }, 500);
  }

  const result = await createPreapproval(unit.id, {
    backUrl: backUrl || undefined,
  });

  if (!result.ok) {
    return json({ error: result.detail || "No se pudo iniciar el pago con Mercado Pago." }, 502);
  }

  if (!result.initPoint) {
    return json({ error: "Mercado Pago no devolvió un link de pago." }, 502);
  }

  return json({
    ok: true,
    initPoint: result.initPoint,
    planCode: plan.code,
    planLabel: plan.label,
    requiresPayment: true,
  });
}
