import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { cancelSubscription } from "@/lib/billing/mp-preapproval";
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
 * Cancels the caller's platform subscription (voluntary — "dar de baja").
 * Body: { unitCode: string }
 */
export async function POST(request: NextRequest) {
  const user = await resolveAuthUser(request);
  if (!user?.email) {
    return json({ error: "Debés iniciar sesión para cancelar la suscripción." }, 401);
  }

  const body = await request.json().catch(() => ({}));
  const unitCode = String(body.unitCode ?? "").trim();
  if (!unitCode) {
    return json({ error: "unitCode es obligatorio." }, 400);
  }

  const db = createAdminClient();
  const unit = await resolveClientUnitForAuthUser(db, { email: user.email, unitCode });
  if (!unit) {
    return json({ error: "No encontramos tu cuenta en este nodo." }, 404);
  }

  const result = await cancelSubscription(unit.id);
  if (!result.ok) {
    return json({ error: result.detail || "No se pudo cancelar la suscripción." }, 502);
  }

  return json({ ok: true });
}
