// @ts-nocheck
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/supabase/auth-guard";
import {
  buildAuthorizationUrl,
  generatePkcePair,
  getMpOAuthConfig,
  newOAuthState,
} from "@/lib/mercadopago/oauth";
import { createServiceClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/** Inicia OAuth: redirige al médico a Mercado Pago para autorizar la app. */
export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;
  const { user } = auth;

  if (!user.org_id) {
    return NextResponse.json({ error: "Org no encontrada" }, { status: 403 });
  }

  const config = getMpOAuthConfig();
  if (!config) {
    return NextResponse.json(
      {
        error:
          "OAuth no configurado. Definí MERCADOPAGO_CLIENT_ID y MERCADOPAGO_CLIENT_SECRET.",
      },
      { status: 503 },
    );
  }

  const { codeVerifier, codeChallenge } = generatePkcePair();
  const state = newOAuthState();
  const now = new Date().toISOString();

  // Store PKCE pending state in office_settings.payment JSONB
  const supabase = await createServiceClient();
  const { data: existing } = await supabase
    .from("office_settings")
    .select("payment")
    .eq("org_id", user.org_id)
    .maybeSingle();

  const payment = ((existing?.payment as Record<string, unknown>) ?? {});
  await supabase
    .from("office_settings")
    .update({
      payment: {
        ...payment,
        mercadopagoEnabled: true,
        mercadopagoOAuthPending: { state, codeVerifier, createdAt: now },
      },
    })
    .eq("org_id", user.org_id);

  const url = buildAuthorizationUrl({ config, state, codeChallenge });
  return NextResponse.redirect(url);
}
